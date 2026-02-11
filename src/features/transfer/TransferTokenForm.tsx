import { Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import {
  KnownProtocolType,
  ProtocolType,
  convertToScaledAmount,
  eqAddress,
  errorToString,
  fromWei,
  isNullish,
  isValidAddressEvm,
  objKeys,
  toWei,
} from '@hyperlane-xyz/utils';
import {
  AccountInfo,
  ChevronIcon,
  SpinnerIcon,
  getAccountAddressAndPubKey,
  useAccountAddressForChain,
  useAccounts,
  useModal,
} from '@hyperlane-xyz/widgets';
import BigNumberJS from 'bignumber.js';
import { Form, Formik, useFormikContext } from 'formik';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { RecipientWarningBanner } from '../../components/banner/RecipientWarningBanner';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { SolidButton } from '../../components/buttons/SolidButton';
import { SwapIcon } from '../../components/icons/SwapIcon';
import { TextField } from '../../components/input/TextField';
import { WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { Color } from '../../styles/Color';
import { logger } from '../../utils/logger';
import { updateQueryParams } from '../../utils/queryParams';
import { trackTransactionFailedEvent } from '../analytics/utils';
import { ChainConnectionWarning } from '../chains/ChainConnectionWarning';
import { ChainWalletWarning } from '../chains/ChainWalletWarning';
import { useChainDisplayName, useMultiProvider } from '../chains/hooks';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { useIsAccountSanctioned } from '../sanctions/hooks/useIsAccountSanctioned';
import { useStore } from '../store';
import { IcaPanel } from '../swap/components/IcaPanel';
import { useIcaAddress } from '../swap/hooks/useIcaAddress';
import { useInterchainAccountApp } from '../swap/hooks/useInterchainAccount';
import { useSwapQuote } from '../swap/hooks/useSwapQuote';
import {
  DEFAULT_SLIPPAGE,
  getSwappableAddress,
  isDemoSwapBridgePath,
  isSwapSupported,
} from '../swap/swapConfig';
import { ImportTokenButton } from '../tokens/ImportTokenButton';
import { TokenSelectField } from '../tokens/TokenSelectField';
import { useIsApproveRequired } from '../tokens/approval';
import {
  getDestinationNativeBalance,
  useDestinationBalance,
  useOriginBalance,
} from '../tokens/balances';
import {
  getInitialTokenKeys,
  getTokenByKey,
  useCollateralGroups,
  useTokens,
  useWarpCore,
} from '../tokens/hooks';
import { useTokenPrice } from '../tokens/useTokenPrice';
import { checkTokenHasRoute, findRouteToken } from '../tokens/utils';
import { WalletConnectionWarning } from '../wallet/WalletConnectionWarning';
import { WalletDropdown } from '../wallet/WalletDropdown';
import { FeeSectionButton } from './FeeSectionButton';
import { RecipientConfirmationModal } from './RecipientConfirmationModal';
import { TransferSection } from './TransferSection';
import { getInterchainQuote, getTotalFee, getTransferToken } from './fees';
import { useFetchMaxAmount } from './maxAmount';
import { TransferFormValues } from './types';
import { useRecipientBalanceWatcher } from './useBalanceWatcher';
import { useFeeQuotes } from './useFeeQuotes';
import { useTokenTransfer } from './useTokenTransfer';
import { TransferRouteType, useTransferRoute } from './useTransferRoute';
import { isSmartContract, shouldClearAddress } from './utils';

export function TransferTokenForm() {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const tokens = useTokens();
  const collateralGroups = useCollateralGroups();

  const { setOriginChainName, routerAddressesByChainMap } = useStore((s) => ({
    setOriginChainName: s.setOriginChainName,
    routerAddressesByChainMap: s.routerAddressesByChainMap,
  }));

  const initialValues = useFormInitialValues();
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);

  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);
  // Flag for check current type of token (setter used by TokenSelectField)
  const [, setIsNft] = useState(false);
  // This state is used for when the formik token is different from
  // the token with highest collateral in a multi-collateral token setup
  const [routeOverrideToken, setRouteTokenOverride] = useState<Token | null>(null);
  // Modal for confirming address
  const {
    open: openConfirmationModal,
    close: closeConfirmationModal,
    isOpen: isConfirmationModalOpen,
  } = useModal();

  const validate = async (values: TransferFormValues) => {
    const routeType = getRouteType(warpCore, tokens, collateralGroups, values);

    // Skip full warp validation for swap-bridge routes
    if (routeType === 'swap-bridge') {
      if (!values.amount || parseFloat(values.amount) <= 0) {
        return { amount: 'Invalid amount' };
      }
      return null;
    }

    const [result, overrideToken] = await validateForm(
      warpCore,
      tokens,
      collateralGroups,
      values,
      accounts,
      routerAddressesByChainMap,
    );

    trackTransactionFailedEvent(result, warpCore, values, accounts, overrideToken);

    // Unless this is done, the review and the transfer would contain
    // the selected token rather than collateral with highest balance
    setRouteTokenOverride(overrideToken);
    return result;
  };

  const onSubmitForm = async (values: TransferFormValues) => {
    const originToken = getTokenByKey(tokens, values.originTokenKey);
    const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);
    if (!originToken || !destinationToken) return;

    // Get recipient (form value or fallback to connected wallet)
    const { address: connectedDestAddress } = getAccountAddressAndPubKey(
      multiProvider,
      destinationToken.chainName,
      accounts,
    );
    const recipient = values.recipient || connectedDestAddress || '';
    if (!recipient) return;

    logger.debug('Checking destination native balance for:', destinationToken.chainName, recipient);
    const balance = await getDestinationNativeBalance(multiProvider, {
      destination: destinationToken.chainName,
      recipient,
    });
    if (isNullish(balance)) return;
    else if (balance > 0n) {
      logger.debug('Reviewing transfer form values');
      setIsReview(true);
    } else {
      logger.debug('Recipient has no balance on destination. Confirming address.');
      openConfirmationModal();
    }
  };

  // Update origin chain name in store when origin token changes
  useEffect(() => {
    const originToken = getTokenByKey(tokens, initialValues.originTokenKey);
    if (originToken) {
      setOriginChainName(originToken.chainName);
    }
  }, [initialValues.originTokenKey, tokens, setOriginChainName]);

  return (
    <Formik<TransferFormValues>
      initialValues={initialValues}
      onSubmit={onSubmitForm}
      validate={validate}
      validateOnChange={false}
      validateOnBlur={false}
    >
      {({ isValidating }) => (
        <Form className="flex w-full flex-col items-stretch gap-1.5">
          <WarningBanners />

          <TransferSection label="Send">
            <OriginTokenCard isReview={isReview} setIsNft={setIsNft} />
          </TransferSection>
          <SwapTokensButton disabled={isReview} />
          <TransferSection label="Receive">
            <DestinationTokenCard isReview={isReview} />
          </TransferSection>

          <ContextualIcaPanel />
          <ReviewDetails isReview={isReview} routeOverrideToken={routeOverrideToken} />
          <ButtonSection
            isReview={isReview}
            isValidating={isValidating}
            setIsReview={setIsReview}
            cleanOverrideToken={() => setRouteTokenOverride(null)}
            routeOverrideToken={routeOverrideToken}
          />
          <RecipientConfirmationModal
            isOpen={isConfirmationModalOpen}
            close={closeConfirmationModal}
            onConfirm={() => setIsReview(true)}
          />
        </Form>
      )}
    </Formik>
  );
}

function SwapTokensButton({ disabled }: { disabled?: boolean }) {
  const { values, setValues } = useFormikContext<TransferFormValues>();
  const tokens = useTokens();
  const multiProvider = useMultiProvider();

  const onSwap = useCallback(() => {
    if (disabled) return;

    const { originTokenKey, destinationTokenKey, recipient } = values;
    const originToken = getTokenByKey(tokens, originTokenKey);
    const destToken = getTokenByKey(tokens, destinationTokenKey);

    if (!originToken || !destToken) return;

    // After swap, origin becomes the new destination - validate recipient for new destination protocol
    const shouldClearRecipient = shouldClearAddress(
      multiProvider,
      recipient,
      originToken.chainName,
    );

    setValues((prevValues) => ({
      ...prevValues,
      amount: '',
      originTokenKey: destinationTokenKey,
      destinationTokenKey: originTokenKey,
      recipient: shouldClearRecipient ? '' : prevValues.recipient,
    }));

    // Update URL params
    if (originToken && destToken) {
      updateQueryParams({
        [WARP_QUERY_PARAMS.ORIGIN]: destToken.chainName,
        [WARP_QUERY_PARAMS.ORIGIN_TOKEN]: destToken.symbol,
        [WARP_QUERY_PARAMS.DESTINATION]: originToken.chainName,
        [WARP_QUERY_PARAMS.DESTINATION_TOKEN]: originToken.symbol,
      });
    }
  }, [disabled, values, tokens, setValues, multiProvider]);

  return (
    <div className="relative z-10 -my-3 flex justify-center">
      <button
        type="button"
        onClick={onSwap}
        disabled={disabled}
        className="group flex h-8 w-8 items-center justify-center rounded border border-gray-400/50 bg-white shadow-button transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SwapIcon
          width={18}
          height={24}
          className="transition-transform duration-300 group-hover:rotate-180 group-disabled:rotate-0"
        />
      </button>
    </div>
  );
}

function OriginTokenCard({
  isReview,
  setIsNft,
}: {
  isReview: boolean;
  setIsNft?: (b: boolean) => void;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const tokens = useTokens();
  const collateralGroups = useCollateralGroups();

  const originToken = getTokenByKey(tokens, values.originTokenKey);
  const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);
  const { balance } = useOriginBalance(originToken);
  const { tokenPrice, isLoading: isPriceLoading } = useTokenPrice(values);

  const { routeType } = useTransferRoute(originToken, destinationToken, collateralGroups);
  const isRouteSupported = routeType !== 'unavailable';

  const amount = parseFloat(values.amount);
  const totalTokenPrice = !isNullish(tokenPrice) && !isNaN(amount) ? amount * tokenPrice : 0;
  const shouldShowPrice = totalTokenPrice >= 0.01;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <WalletDropdown
          chainName={originToken?.chainName}
          selectionMode="origin"
          disabled={isReview}
        />
        <ImportTokenButton token={originToken} />
      </div>

      <div className="rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input">
        <TokenSelectField
          name="originTokenKey"
          selectionMode="origin"
          disabled={isReview}
          setIsNft={setIsNft}
          showLabel={false}
        />

        <div className="my-2.5 h-px bg-primary-50" />

        <div className="flex items-center justify-between gap-2">
          <TextField
            name="amount"
            placeholder="0"
            className="w-full flex-1 border-none bg-transparent font-secondary text-xl font-normal text-gray-900 outline-none placeholder:text-gray-900"
            type="number"
            step="any"
            disabled={isReview}
          />
          <MaxButton balance={balance} disabled={isReview} isRouteSupported={isRouteSupported} />
        </div>
        <div className="mt-1 flex items-center justify-between text-xs leading-[18px] text-gray-450">
          <span>
            {shouldShowPrice && !isPriceLoading ? (
              <>
                $
                {totalTokenPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </>
            ) : (
              '$0.00'
            )}
          </span>
          <TokenBalance label="Balance" balance={balance} />
        </div>
      </div>
    </div>
  );
}

function DestinationTokenCard({ isReview }: { isReview: boolean }) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const tokens = useTokens();
  const collateralGroups = useCollateralGroups();
  const multiProvider = useMultiProvider();

  const originToken = getTokenByKey(tokens, values.originTokenKey);
  const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);
  const { routeType } = useTransferRoute(originToken, destinationToken, collateralGroups);

  const senderAddress = useAccountAddressForChain(multiProvider, originToken?.chainName);
  const icaApp = useInterchainAccountApp();
  const { icaAddress } = useIcaAddress(
    icaApp,
    senderAddress ?? undefined,
    originToken?.chainName,
    destinationToken?.chainName,
  );

  const connectedDestAddress = useAccountAddressForChain(
    multiProvider,
    destinationToken?.chainName,
  );

  const isSwapBridge = routeType === 'swap-bridge';
  const recipient =
    isSwapBridge && icaAddress ? icaAddress : values.recipient || connectedDestAddress;

  const { balance } = useDestinationBalance(recipient, destinationToken);

  useRecipientBalanceWatcher(recipient, balance);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <WalletDropdown
          chainName={destinationToken?.chainName}
          selectionMode="destination"
          recipient={values.recipient}
          onRecipientChange={(addr: string) => setFieldValue('recipient', addr)}
          disabled={isReview || isSwapBridge}
        />
        <ImportTokenButton token={destinationToken} />
      </div>

      <div className="rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input">
        <TokenSelectField
          name="destinationTokenKey"
          selectionMode="destination"
          disabled={isReview}
          showLabel={false}
        />

        <div className="my-2.5 h-px bg-primary-50" />

        {isSwapBridge && icaAddress && (
          <div className="mb-2 flex items-center gap-1.5 rounded border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-700">
            <span className="font-medium">Unified Account</span>
            <span className="truncate text-primary-500">{icaAddress}</span>
          </div>
        )}

        <TokenBalance label="Remote Balance" balance={balance} />
      </div>
    </div>
  );
}

function MaxButton({
  balance,
  disabled,
  isRouteSupported,
}: {
  balance?: TokenAmount;
  disabled?: boolean;
  isRouteSupported: boolean;
}) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { originTokenKey, destinationTokenKey } = values;
  const tokens = useTokens();
  const originToken = getTokenByKey(tokens, originTokenKey);
  const destinationToken = getTokenByKey(tokens, destinationTokenKey);
  const multiProvider = useMultiProvider();
  const { accounts } = useAccounts(multiProvider);
  const { fetchMaxAmount, isLoading } = useFetchMaxAmount();

  const isDisabled =
    disabled || !isRouteSupported || isLoading || !balance || !originToken || !destinationToken;

  const onClick = async () => {
    if (isDisabled) return;
    const maxAmount = await fetchMaxAmount({
      balance,
      origin: originToken.chainName,
      destination: destinationToken.chainName,
      accounts,
      recipient: values.recipient,
    });
    if (isNullish(maxAmount)) return;
    const decimalsAmount = maxAmount.getDecimalFormattedAmount();
    const roundedAmount = new BigNumberJS(decimalsAmount).toFixed(4, BigNumberJS.ROUND_FLOOR);
    setFieldValue('amount', roundedAmount);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className="rounded border border-gray-300 px-2 py-0.5 font-secondary text-sm text-gray-450 transition-colors hover:border-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? <SpinnerIcon className="h-4 w-4" /> : 'Max'}
    </button>
  );
}

function TokenBalance({
  label,
  balance,
}: {
  label: string;
  balance: TokenAmount | null | undefined;
}) {
  return (
    <span className="text-xs leading-[18px] text-gray-450">
      {balance ? (
        <>
          {label}: {balance.getDecimalFormattedAmount().toFixed(4)} {balance.token.symbol}
        </>
      ) : (
        <>{label}: 0.00</>
      )}
    </span>
  );
}

function ContextualIcaPanel() {
  const { values } = useFormikContext<TransferFormValues>();
  const tokens = useTokens();
  const collateralGroups = useCollateralGroups();
  const multiProvider = useMultiProvider();

  const originToken = getTokenByKey(tokens, values.originTokenKey);
  const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);
  const { routeType } = useTransferRoute(originToken, destinationToken, collateralGroups);
  const senderAddress = useAccountAddressForChain(multiProvider, originToken?.chainName);

  if (routeType !== 'swap-bridge' || !originToken || !destinationToken || !senderAddress) {
    return null;
  }

  return (
    <IcaPanel
      userAddress={senderAddress}
      originChainName={originToken.chainName}
      destinationChainName={destinationToken.chainName}
    />
  );
}

function ButtonSection({
  isReview,
  isValidating,
  setIsReview,
  cleanOverrideToken,
  routeOverrideToken,
}: {
  isReview: boolean;
  isValidating: boolean;
  setIsReview: (b: boolean) => void;
  cleanOverrideToken: () => void;
  routeOverrideToken: Token | null;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const multiProvider = useMultiProvider();
  const tokens = useTokens();
  const collateralGroups = useCollateralGroups();
  const originToken = routeOverrideToken || getTokenByKey(tokens, values.originTokenKey);
  const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);
  const chainDisplayName = useChainDisplayName(destinationToken?.chainName || '');
  const { routeType } = useTransferRoute(originToken, destinationToken, collateralGroups);
  const isRouteSupported = routeType !== 'unavailable';

  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);
  const { address: connectedWallet } = getAccountAddressAndPubKey(
    multiProvider,
    originToken?.chainName,
    accounts,
  );

  const { address: connectedDestAddress } = getAccountAddressAndPubKey(
    multiProvider,
    destinationToken?.chainName,
    accounts,
  );
  const recipient = values.recipient || connectedDestAddress || '';

  const [{ addressConfirmed, showWarning }, setRecipientInfos] = useState({
    showWarning: false,
    addressConfirmed: true,
  });

  useEffect(() => {
    let isMounted = true;

    const checkSameEVMRecipient = async (recipient: string) => {
      if (!connectedWallet || !originToken || !destinationToken) {
        setRecipientInfos({ showWarning: false, addressConfirmed: true });
        return;
      }

      const { protocol: destinationProtocol } = multiProvider.getChainMetadata(
        destinationToken.chainName,
      );
      const { protocol: sourceProtocol } = multiProvider.getChainMetadata(originToken.chainName);

      if (
        sourceProtocol !== ProtocolType.Ethereum ||
        destinationProtocol !== ProtocolType.Ethereum
      ) {
        setRecipientInfos({ showWarning: false, addressConfirmed: true });
        return;
      }

      if (!isValidAddressEvm(recipient)) {
        setRecipientInfos({ showWarning: false, addressConfirmed: true });
        return;
      }

      const { isContract: isSenderSmartContract, error: senderCheckError } = await isSmartContract(
        multiProvider,
        originToken.chainName,
        connectedWallet,
      );
      if (!isMounted) return;

      const { isContract: isRecipientSmartContract, error: recipientCheckError } =
        await isSmartContract(multiProvider, destinationToken.chainName, recipient);
      if (!isMounted) return;

      const isSelfRecipient = eqAddress(recipient, connectedWallet);

      if (senderCheckError || recipientCheckError) {
        toast.error(senderCheckError || recipientCheckError);
        setRecipientInfos({ addressConfirmed: true, showWarning: false });
        return;
      }

      if (isSelfRecipient && isSenderSmartContract && !isRecipientSmartContract) {
        const msg = `The recipient address is the same as the connected wallet, but it does not exist as a smart contract on ${chainDisplayName}.`;
        logger.warn(msg);
        setRecipientInfos({ showWarning: true, addressConfirmed: false });
      } else {
        setRecipientInfos({ showWarning: false, addressConfirmed: true });
      }
    };
    checkSameEVMRecipient(recipient);

    return () => {
      isMounted = false;
    };
  }, [recipient, connectedWallet, multiProvider, originToken, destinationToken, chainDisplayName]);

  const isSanctioned = useIsAccountSanctioned();

  const { setTransferLoading } = useStore((s) => ({
    setTransferLoading: s.setTransferLoading,
  }));

  const onDoneTransactions = () => {
    setIsReview(false);
    cleanOverrideToken();
  };
  const { triggerTransactions } = useTokenTransfer(onDoneTransactions);

  const triggerTransactionsHandler = async () => {
    if (isSanctioned || !originToken || !destinationToken) return;
    setIsReview(false);
    setTransferLoading(true);

    await triggerTransactions(values, routeOverrideToken, routeType, {
      icaAddress: icaAddress ?? undefined,
      swapOutput: swapQuoteCache?.swapOutput,
      bridgeFee: swapQuoteCache?.bridgeFee,
    });
    setTransferLoading(false);
  };

  const onEdit = () => {
    setIsReview(false);
    cleanOverrideToken();
  };

  const isSwapBridge = routeType === 'swap-bridge';

  // Pre-fetch ICA address and swap quote for swap-bridge to avoid redundant RPC calls
  const senderAddress = useAccountAddressForChain(multiProvider, originToken?.chainName);
  const icaApp = useInterchainAccountApp();
  const { icaAddress } = useIcaAddress(
    isSwapBridge ? icaApp : null,
    isSwapBridge ? (senderAddress ?? undefined) : undefined,
    isSwapBridge ? originToken?.chainName : undefined,
    isSwapBridge ? destinationToken?.chainName : undefined,
  );

  const amountWeiForCache = useMemo(() => {
    if (!isSwapBridge || !originToken || !values.amount || parseFloat(values.amount) <= 0)
      return undefined;
    try {
      return toWei(values.amount, originToken.decimals);
    } catch {
      return undefined;
    }
  }, [isSwapBridge, originToken, values.amount]);

  const originSwapAddress =
    isSwapBridge && originToken ? getSwappableAddress(originToken) : undefined;

  const { data: swapQuoteCache } = useSwapQuote(
    isSwapBridge ? originToken?.chainName : undefined,
    isSwapBridge ? destinationToken?.chainName : undefined,
    originSwapAddress,
    amountWeiForCache,
  );

  const text = !isRouteSupported
    ? 'Route is not supported'
    : isValidating
      ? 'Validating...'
      : 'Continue';

  if (!isReview) {
    return (
      <>
        <div
          className={`gap-2 bg-amber-400 px-4 text-sm ${
            showWarning ? 'max-h-38 py-2' : 'max-h-0'
          } overflow-hidden transition-all duration-500`}
        >
          <RecipientWarningBanner
            destinationChain={chainDisplayName}
            confirmRecipientHandler={(checked) =>
              setRecipientInfos((state) => ({ ...state, addressConfirmed: checked }))
            }
          />
        </div>

        <ConnectAwareSubmitButton
          disabled={!addressConfirmed || !isRouteSupported}
          chainName={originToken?.chainName || ''}
          text={text}
          classes="w-full mb-4 px-3 py-2.5 font-secondary text-xl text-cream-100"
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`gap-2 bg-amber-400 px-4 text-sm ${
          showWarning ? 'max-h-38 py-2' : 'max-h-0'
        } overflow-hidden transition-all duration-500`}
      >
        <RecipientWarningBanner
          destinationChain={chainDisplayName}
          confirmRecipientHandler={(checked) =>
            setRecipientInfos((state) => ({ ...state, addressConfirmed: checked }))
          }
        />
      </div>
      <div className="mb-4 mt-4 flex items-center justify-between space-x-4">
        <SolidButton
          type="button"
          color="primary"
          onClick={onEdit}
          className="px-6 py-1.5 font-secondary"
          icon={<ChevronIcon direction="w" width={10} height={6} color={Color.white} />}
        >
          <span>Edit</span>
        </SolidButton>
        <SolidButton
          disabled={!addressConfirmed || isSanctioned}
          type="button"
          color="accent"
          onClick={triggerTransactionsHandler}
          className="flex-1 px-3 py-1.5 font-secondary text-white"
        >
          {isSwapBridge ? `Swap & Bridge to ${chainDisplayName}` : `Send to ${chainDisplayName}`}
        </SolidButton>
      </div>
    </>
  );
}

function ReviewDetails({
  isReview,
  routeOverrideToken,
}: {
  isReview: boolean;
  routeOverrideToken: Token | null;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const warpCore = useWarpCore();
  const { amount, originTokenKey, destinationTokenKey } = values;
  const tokens = useTokens();
  const collateralGroups = useCollateralGroups();
  const originTokenByKey = routeOverrideToken || getTokenByKey(tokens, originTokenKey);
  const destinationTokenByKey = getTokenByKey(tokens, destinationTokenKey);

  const { routeType } = useTransferRoute(originTokenByKey, destinationTokenByKey, collateralGroups);
  const isSwapBridge = routeType === 'swap-bridge';

  const originToken =
    !isSwapBridge && destinationTokenByKey && originTokenByKey
      ? findRouteToken(warpCore, originTokenByKey, destinationTokenByKey.chainName)
      : originTokenByKey;
  const destinationToken =
    !isSwapBridge && destinationTokenByKey && originToken
      ? originToken.getConnectionForChain(destinationTokenByKey.chainName)?.token
      : destinationTokenByKey;
  const originTokenSymbol = originToken?.symbol || '';
  const isNft = !isSwapBridge && originToken?.isNft();
  const isRouteSupported = routeType !== 'unavailable';

  const scaledAmount = useMemo(() => {
    if (isSwapBridge) return null;
    if (!originToken?.scale || !destinationToken?.scale) return null;
    if (!isReview || originToken.scale === destinationToken.scale) return null;

    const amountWei = toWei(amount, originToken.decimals);
    const precisionFactor = 100000;

    const convertedAmount = convertToScaledAmount({
      amount: BigInt(amountWei),
      fromScale: originToken.scale,
      toScale: destinationToken.scale,
      precisionFactor,
    });
    const value = convertedAmount / BigInt(precisionFactor);

    return {
      value: fromWei(value.toString(), originToken.decimals),
      originScale: originToken.scale,
      destinationScale: destinationToken.scale,
    };
  }, [amount, originToken, destinationToken, isReview, isSwapBridge]);

  const amountWei = isNft ? amount.toString() : toWei(amount, originToken?.decimals);

  const { isLoading: isApproveLoading, isApproveRequired } = useIsApproveRequired(
    isSwapBridge ? undefined : originToken,
    amountWei,
    isReview,
  );
  const { isLoading: isQuoteLoading, fees: feeQuotes } = useFeeQuotes(
    values,
    isRouteSupported && !isSwapBridge,
    isSwapBridge ? undefined : originToken,
    isSwapBridge ? undefined : destinationToken,
    !isReview,
  );

  const amountWeiForQuote = useMemo(() => {
    if (!isSwapBridge || !originToken || !amount || parseFloat(amount) <= 0) return undefined;
    try {
      return toWei(amount, originToken.decimals);
    } catch {
      return undefined;
    }
  }, [isSwapBridge, originToken, amount]);

  const originSwapAddressForQuote =
    isSwapBridge && originToken ? getSwappableAddress(originToken) : undefined;

  const { data: swapQuote, isLoading: isSwapQuoteLoading } = useSwapQuote(
    isSwapBridge ? originToken?.chainName : undefined,
    isSwapBridge ? destinationTokenByKey?.chainName : undefined,
    originSwapAddressForQuote,
    amountWeiForQuote,
  );

  const isLoading = isSwapBridge ? isSwapQuoteLoading : isApproveLoading || isQuoteLoading;

  const fees = useMemo(() => {
    if (isSwapBridge || !feeQuotes) return null;

    const interchainQuote = getInterchainQuote(originToken, feeQuotes.interchainQuote);
    const fees = {
      ...feeQuotes,
      interchainQuote: interchainQuote || feeQuotes.interchainQuote,
    };
    const totalFees = getTotalFee({
      ...fees,
      interchainQuote: interchainQuote || fees.interchainQuote,
    })
      .map((fee) => `${fee.getDecimalFormattedAmount().toFixed(8)} ${fee.token.symbol}`)
      .join(', ');

    return {
      ...fees,
      totalFees,
    };
  }, [feeQuotes, originToken, isSwapBridge]);

  return (
    <>
      {!isReview && !isSwapBridge && (
        <FeeSectionButton visible={!isReview} fees={fees} isLoading={isLoading} />
      )}

      <div
        className={`${
          isReview ? 'max-h-screen duration-1000 ease-in' : 'max-h-0 duration-500'
        } overflow-hidden transition-all`}
      >
        <label className="mt-4 block pl-0.5 text-sm text-gray-600">Transactions</label>
        <div className="mt-1.5 space-y-2 break-all rounded border border-gray-400 bg-gray-150 px-2.5 py-2 text-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <SpinnerIcon className="h-5 w-5" />
            </div>
          ) : isSwapBridge ? (
            <div>
              <h4>Swap & Bridge</h4>
              <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs">
                <p className="flex">
                  <span className="min-w-[7.5rem]">Amount</span>
                  <span>{`${amount} ${originTokenSymbol}`}</span>
                </p>
                <p className="flex">
                  <span className="min-w-[7.5rem]">Route</span>
                  <span>{`${originTokenSymbol}${originTokenSymbol !== 'USDC' ? ' → USDC' : ''} (${originToken?.chainName || ''}) → ${destinationToken?.symbol || 'USDC'} (${destinationToken?.chainName || ''})`}</span>
                </p>
                {swapQuote && (
                  <>
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Est. Received</span>
                      <span>{`~${fromWei(swapQuote.swapOutput.toString(), destinationToken?.decimals)} ${destinationToken?.symbol || 'USDC'}`}</span>
                    </p>
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Bridge Fee</span>
                      <span>{`${fromWei(swapQuote.bridgeFee.toString())} ETH`}</span>
                    </p>
                  </>
                )}
                <p className="flex">
                  <span className="min-w-[7.5rem]">Slippage</span>
                  <span>{`${DEFAULT_SLIPPAGE * 100}%`}</span>
                </p>
                <p className="flex">
                  <span className="min-w-[7.5rem]">Delivery</span>
                  <span>Via Unified Account (ICA)</span>
                </p>
              </div>
            </div>
          ) : (
            <>
              {isApproveRequired && (
                <div>
                  <h4>Transaction 1: Approve Transfer</h4>
                  <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs">
                    <p>{`Router Address: ${originToken?.addressOrDenom}`}</p>
                    {originToken?.collateralAddressOrDenom && (
                      <p>{`Collateral Address: ${originToken.collateralAddressOrDenom}`}</p>
                    )}
                  </div>
                </div>
              )}
              <div>
                <h4>{`Transaction${isApproveRequired ? ' 2' : ''}: Transfer Remote`}</h4>
                <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs">
                  {destinationToken?.addressOrDenom && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Remote Token</span>
                      <span>{destinationToken.addressOrDenom}</span>
                    </p>
                  )}

                  <p className="flex">
                    <span className="min-w-[7.5rem]">{isNft ? 'Token ID' : 'Amount'}</span>
                    <span>{`${amount} ${originTokenSymbol}`}</span>
                  </p>
                  {scaledAmount && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Received Amount</span>
                      <span>{`${scaledAmount.value} ${originTokenSymbol} (scaled from ${scaledAmount.originScale} to ${scaledAmount.destinationScale})`}</span>
                    </p>
                  )}
                  {fees?.localQuote && fees.localQuote.amount > 0n && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Local Gas (est.)</span>
                      <span>{`${fees.localQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                        fees.localQuote.token.symbol || ''
                      }`}</span>
                    </p>
                  )}
                  {fees?.interchainQuote && fees.interchainQuote.amount > 0n && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Interchain Gas</span>
                      <span>{`${fees.interchainQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                        fees.interchainQuote.token.symbol || ''
                      }`}</span>
                    </p>
                  )}
                  {fees?.tokenFeeQuote && fees.tokenFeeQuote.amount > 0n && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Token Fee</span>
                      <span>{`${fees.tokenFeeQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                        fees.tokenFeeQuote.token.symbol || ''
                      }`}</span>
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function WarningBanners() {
  const { values } = useFormikContext<TransferFormValues>();
  const tokens = useTokens();
  const originToken = getTokenByKey(tokens, values.originTokenKey);
  const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);

  return (
    // Max height to prevent double padding if multiple warnings are visible
    <div className="max-h-10">
      <ChainWalletWarning origin={originToken?.chainName || ''} />
      <ChainConnectionWarning
        origin={originToken?.chainName || ''}
        destination={destinationToken?.chainName || ''}
      />
      <WalletConnectionWarning origin={originToken?.chainName || ''} />
    </div>
  );
}

function useFormInitialValues(): TransferFormValues {
  const warpCore = useWarpCore();
  const tokens = useTokens();

  const { originTokenKey, destinationTokenKey } = getInitialTokenKeys(warpCore, tokens);

  return useMemo(
    () => ({
      originTokenKey,
      destinationTokenKey,
      amount: '',
      recipient: '',
    }),
    [originTokenKey, destinationTokenKey],
  );
}

function getRouteType(
  _warpCore: WarpCore,
  tokens: Token[],
  collateralGroups: Map<string, Token[]>,
  values: TransferFormValues,
): TransferRouteType {
  const originToken = getTokenByKey(tokens, values.originTokenKey);
  const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);
  if (!originToken || !destinationToken) return 'unavailable';
  if (checkTokenHasRoute(originToken, destinationToken, collateralGroups)) return 'warp';
  if (isSwapSupported(originToken.chainName, destinationToken.chainName)) {
    const destinationTokenAddress =
      getSwappableAddress(destinationToken) ?? destinationToken.addressOrDenom;
    if (
      isDemoSwapBridgePath({
        originChainName: originToken.chainName,
        destinationChainName: destinationToken.chainName,
        destinationTokenAddress,
      })
    ) {
      return 'swap-bridge';
    }
  }
  return 'unavailable';
}

const insufficientFundsErrMsg = /insufficient.[funds|lamports]/i;
const emptyAccountErrMsg = /AccountNotFound/i;

async function validateForm(
  warpCore: WarpCore,
  tokens: Token[],
  collateralGroups: Map<string, Token[]>,
  values: TransferFormValues,
  accounts: Record<KnownProtocolType, AccountInfo>,
  routerAddressesByChainMap: Record<ChainName, Set<string>>,
): Promise<[Record<string, string> | null, Token | null]> {
  // returns a tuple, where first value is validation result
  // and second value is token override
  try {
    const { originTokenKey, destinationTokenKey, amount, recipient: formRecipient } = values;

    // Look up tokens from the unified array
    const token = getTokenByKey(tokens, originTokenKey);
    const destinationToken = getTokenByKey(tokens, destinationTokenKey);

    if (!amount) return [{ amount: 'Invalid amount' }, null];
    if (!token) return [{ originTokenKey: 'Origin token is required' }, null];
    if (!destinationToken) return [{ destinationTokenKey: 'Destination token is required' }, null];

    // Use form recipient if set, otherwise fallback to connected wallet for destination chain
    const { address: connectedDestAddress } = getAccountAddressAndPubKey(
      warpCore.multiProvider,
      destinationToken.chainName,
      accounts,
    );
    const recipient = formRecipient || connectedDestAddress || '';

    if (!recipient) return [{ amount: 'Invalid recipient' }, null];

    // Early route check using collateral groups - validates origin token can reach destination token
    if (!checkTokenHasRoute(token, destinationToken, collateralGroups)) {
      return [{ destinationTokenKey: 'Route is not supported' }, null];
    }

    const destination = destinationToken.chainName;

    if (
      objKeys(routerAddressesByChainMap).includes(destination) &&
      routerAddressesByChainMap[destination].has(recipient)
    ) {
      return [{ recipient: 'Warp Route address is not valid as recipient' }, null];
    }

    const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
      warpCore.multiProvider,
      token.chainName,
      accounts,
    );

    const amountWei = toWei(amount, token.decimals);
    const transferToken = await getTransferToken(
      warpCore,
      token,
      destinationToken,
      amountWei,
      recipient,
      sender,
      defaultMultiCollateralRoutes,
    );

    // This should not happen since we already checked the route above, but keep as safety check
    const connection = transferToken.getConnectionForChain(destination);
    if (!connection) {
      return [{ destinationTokenKey: 'Route is not supported' }, null];
    }

    const multiCollateralLimit = isMultiCollateralLimitExceeded(token, destination, amountWei);

    if (multiCollateralLimit) {
      return [
        {
          amount: `Transfer limit is ${fromWei(multiCollateralLimit.toString(), token.decimals)} ${token.symbol}`,
        },
        null,
      ];
    }

    const result = await warpCore.validateTransfer({
      originTokenAmount: transferToken.amount(amountWei),
      destination,
      recipient,
      sender: sender || '',
      senderPubKey: await senderPubKey,
    });

    if (!isNullish(result)) return [result, null];

    if (transferToken.addressOrDenom === token.addressOrDenom) return [null, null];

    return [null, transferToken];
  } catch (error: any) {
    logger.error('Error validating form', error);
    let errorMsg = errorToString(error, 40);
    const fullError = `${errorMsg} ${error.message}`;
    if (insufficientFundsErrMsg.test(fullError) || emptyAccountErrMsg.test(fullError)) {
      const originToken = getTokenByKey(tokens, values.originTokenKey);
      const chainMetadata = originToken
        ? warpCore.multiProvider.tryGetChainMetadata(originToken.chainName)
        : null;
      const symbol = chainMetadata?.nativeToken?.symbol || 'funds';
      errorMsg = `Insufficient ${symbol} for gas fees`;
    }
    return [{ form: errorMsg }, null];
  }
}
