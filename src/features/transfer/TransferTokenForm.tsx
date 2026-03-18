import { Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import {
<<<<<<< HEAD
=======
  KnownProtocolType,
>>>>>>> origin/main
  ProtocolType,
  convertToScaledAmount,
  eqAddress,
  errorToString,
  fromWei,
  isNullish,
  isValidAddressEvm,
<<<<<<< HEAD
  objKeys,
=======
  normalizeAddress,
>>>>>>> origin/main
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
import BigNumber from 'bignumber.js';
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
<<<<<<< HEAD
import { getQueryParams, updateQueryParam } from '../../utils/queryParams';
import { trackTransactionFailedEvent } from '../analytics/utils';
import { ChainConnectionWarning } from '../chains/ChainConnectionWarning';
import { ChainSelectField } from '../chains/ChainSelectField';
import { ChainWalletWarning } from '../chains/ChainWalletWarning';
import { useChainDisplayName, useMultiProvider } from '../chains/hooks';
import { getNumRoutesWithSelectedChain, tryGetValidChainName } from '../chains/utils';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { useIsAccountSanctioned } from '../sanctions/hooks/useIsAccountSanctioned';
import { useStore } from '../store';
import { SelectOrInputTokenIds } from '../tokens/SelectOrInputTokenIds';
import { TokenSelectField } from '../tokens/TokenSelectField';
import { useIsApproveRequired } from '../tokens/approval';
=======
import { updateQueryParams } from '../../utils/queryParams';
import { trackTransactionFailedEvent } from '../analytics/utils';
import { UsdLabel } from '../balances/UsdLabel';
>>>>>>> origin/main
import {
  getDestinationNativeBalance,
  useDestinationBalance,
  useOriginBalance,
} from '../balances/hooks';
import { useFeePrices } from '../balances/useFeePrices';
import { ChainConnectionWarning } from '../chains/ChainConnectionWarning';
import { ChainWalletWarning } from '../chains/ChainWalletWarning';
import { useChainDisplayName, useMultiProvider } from '../chains/hooks';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { useIsAccountSanctioned } from '../sanctions/hooks/useIsAccountSanctioned';
import { RouterAddressInfo, useStore } from '../store';
import { ImportTokenButton } from '../tokens/ImportTokenButton';
import { TokenSelectField } from '../tokens/TokenSelectField';
import { useIsApproveRequired } from '../tokens/approval';
import {
<<<<<<< HEAD
  getIndexForToken,
  getInitialTokenIndex,
  getTokenByIndex,
  getTokenIndexFromChains,
  useWarpCore,
} from '../tokens/hooks';
import { useTokenPrice } from '../tokens/useTokenPrice';
import { WalletConnectionWarning } from '../wallet/WalletConnectionWarning';
import { FeeSectionButton } from './FeeSectionButton';
import { RecipientConfirmationModal } from './RecipientConfirmationModal';
import { getInterchainQuote, getLowestFeeTransferToken, getTotalFee } from './fees';
=======
  getInitialTokenKeys,
  getTokenByKeyFromMap,
  useCollateralGroups,
  useTokenByKeyMap,
  useTokens,
  useWarpCore,
} from '../tokens/hooks';
import { useTokenPrices } from '../tokens/useTokenPrice';
import { checkTokenHasRoute, findRouteToken } from '../tokens/utils';
import { WalletConnectionWarning } from '../wallet/WalletConnectionWarning';
import { WalletDropdown } from '../wallet/WalletDropdown';
import { FeeSectionButton } from './FeeSectionButton';
import { RecipientConfirmationModal } from './RecipientConfirmationModal';
import { TransferSection } from './TransferSection';
import { getInterchainQuote, getTotalFee, getTransferToken } from './fees';
>>>>>>> origin/main
import { useFetchMaxAmount } from './maxAmount';
import { TransferFormValues } from './types';
import { useRecipientBalanceWatcher } from './useBalanceWatcher';
import { useFeeQuotes } from './useFeeQuotes';
import { useTokenTransfer } from './useTokenTransfer';
<<<<<<< HEAD
import { isSmartContract } from './utils';
=======
import { isSmartContract, shouldClearAddress } from './utils';
>>>>>>> origin/main

export function TransferTokenForm() {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const tokenMap = useTokenByKeyMap();
  const collateralGroups = useCollateralGroups();

  const { setOriginChainName, routerAddressesByChainMap } = useStore((s) => ({
    setOriginChainName: s.setOriginChainName,
    routerAddressesByChainMap: s.routerAddressesByChainMap,
  }));

  const initialValues = useFormInitialValues();
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);

  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);
<<<<<<< HEAD
  // Flag for check current type of token
  const [isNft, setIsNft] = useState(false);
=======
  // Flag for check current type of token (setter used by TokenSelectField)
  const [, setIsNft] = useState(false);
>>>>>>> origin/main
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
    const [result, overrideToken] = await validateForm(
      warpCore,
<<<<<<< HEAD
=======
      tokenMap,
      collateralGroups,
>>>>>>> origin/main
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
    const originToken = getTokenByKeyFromMap(tokenMap, values.originTokenKey);
    const destinationToken = getTokenByKeyFromMap(tokenMap, values.destinationTokenKey);
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
    const originToken = getTokenByKeyFromMap(tokenMap, initialValues.originTokenKey);
    if (originToken) {
      setOriginChainName(originToken.chainName);
    }
  }, [initialValues.originTokenKey, tokenMap, setOriginChainName]);

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
<<<<<<< HEAD
          <ChainSelectSection isReview={isReview} />
          <div className="mt-2.5 flex items-end justify-between space-x-4">
            <TokenSection setIsNft={setIsNft} isReview={isReview} />
            <AmountSection isNft={isNft} isReview={isReview} />
          </div>
          <RecipientSection isReview={isReview} />
=======

          <TransferSection label="Send">
            <OriginTokenCard isReview={isReview} setIsNft={setIsNft} />
          </TransferSection>
          <SwapTokensButton disabled={isReview} />
          <TransferSection label="Receive">
            <DestinationTokenCard isReview={isReview} />
          </TransferSection>

>>>>>>> origin/main
          <ReviewDetails isReview={isReview} routeOverrideToken={routeOverrideToken} />
          <ButtonSection
            isReview={isReview}
            isValidating={isValidating}
            setIsReview={setIsReview}
            cleanOverrideToken={() => setRouteTokenOverride(null)}
            routeOverrideToken={routeOverrideToken}
<<<<<<< HEAD
            warpCore={warpCore}
=======
>>>>>>> origin/main
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
  const tokenMap = useTokenByKeyMap();
  const multiProvider = useMultiProvider();

  const onSwap = useCallback(() => {
    if (disabled) return;

    const { originTokenKey, destinationTokenKey, recipient } = values;
    const originToken = getTokenByKeyFromMap(tokenMap, originTokenKey);
    const destToken = getTokenByKeyFromMap(tokenMap, destinationTokenKey);

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

<<<<<<< HEAD
  const originRouteCounts = useMemo(() => {
    return getNumRoutesWithSelectedChain(warpCore, values.origin, true);
  }, [values.origin, warpCore]);

  const destinationRouteCounts = useMemo(() => {
    return getNumRoutesWithSelectedChain(warpCore, values.destination, false);
  }, [values.destination, warpCore]);

  const { originToken, destinationToken } = useMemo(() => {
    const originToken = getTokenByIndex(warpCore, values.tokenIndex);
    if (!originToken) return { originToken: undefined, destinationToken: undefined };
    const destinationToken = originToken.getConnectionForChain(values.destination)?.token;
    return { originToken, destinationToken };
  }, [values.tokenIndex, values.destination, warpCore]);

  const setTokenOnChainChange = (origin: string, destination: string) => {
    const tokenIndex = getTokenIndexFromChains(warpCore, null, origin, destination);
    const token = getTokenByIndex(warpCore, tokenIndex);
    updateQueryParam(WARP_QUERY_PARAMS.TOKEN, token?.symbol);
    setFieldValue('tokenIndex', tokenIndex);
  };

  const handleChange = (chainName: string, fieldName: string) => {
    if (fieldName === WARP_QUERY_PARAMS.ORIGIN) {
      setTokenOnChainChange(chainName, values.destination);
      setOriginChainName(chainName);
    } else if (fieldName === WARP_QUERY_PARAMS.DESTINATION) {
      setTokenOnChainChange(values.origin, chainName);
=======
    // Update URL params
    if (originToken && destToken) {
      updateQueryParams({
        [WARP_QUERY_PARAMS.ORIGIN]: destToken.chainName,
        [WARP_QUERY_PARAMS.ORIGIN_TOKEN]: destToken.symbol,
        [WARP_QUERY_PARAMS.DESTINATION]: originToken.chainName,
        [WARP_QUERY_PARAMS.DESTINATION_TOKEN]: originToken.symbol,
      });
>>>>>>> origin/main
    }
  }, [disabled, values, tokenMap, setValues, multiProvider]);

  return (
<<<<<<< HEAD
    <div className="mt-2 flex items-center justify-between gap-4">
      <ChainSelectField
        name="origin"
        label="From"
        disabled={isReview}
        customListItemField={destinationRouteCounts}
        onChange={handleChange}
        token={originToken}
      />
      <div className="flex flex-1 flex-col items-center">
        <SwapChainsButton disabled={isReview} onSwapChain={onSwapChain} />
      </div>
      <ChainSelectField
        name="destination"
        label="To"
        disabled={isReview}
        customListItemField={originRouteCounts}
        onChange={handleChange}
        token={destinationToken}
      />
=======
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
>>>>>>> origin/main
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
<<<<<<< HEAD
  const { balance } = useOriginBalance(values);
  const { tokenPrice, isLoading } = useTokenPrice(values);
=======
  const tokenMap = useTokenByKeyMap();
  const collateralGroups = useCollateralGroups();

  const originToken = getTokenByKeyFromMap(tokenMap, values.originTokenKey);
  const destinationToken = getTokenByKeyFromMap(tokenMap, values.destinationTokenKey);
  const { balance } = useOriginBalance(originToken);
  const { prices, isLoading: isPriceLoading } = useTokenPrices();
  const tokenPrice = originToken?.coinGeckoId ? prices[originToken.coinGeckoId] : undefined;

  const isRouteSupported = useMemo(() => {
    if (!originToken || !destinationToken) return true;
    return checkTokenHasRoute(originToken, destinationToken, collateralGroups);
  }, [originToken, destinationToken, collateralGroups]);
>>>>>>> origin/main

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
<<<<<<< HEAD
          {shouldShowPrice && !isLoading && (
            <div className="absolute bottom-[-18px] left-1 max-w-52 overflow-hidden text-ellipsis whitespace-nowrap text-xxs text-gray-500">
              ≈$
              {totalTokenPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          )}
          <MaxButton disabled={isReview} balance={balance} />
=======
          <MaxButton balance={balance} disabled={isReview} isRouteSupported={isRouteSupported} />
>>>>>>> origin/main
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
  const tokenMap = useTokenByKeyMap();
  const multiProvider = useMultiProvider();

  const destinationToken = getTokenByKeyFromMap(tokenMap, values.destinationTokenKey);

  const connectedDestAddress = useAccountAddressForChain(
    multiProvider,
    destinationToken?.chainName,
  );
  const recipient = values.recipient || connectedDestAddress;

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
          disabled={isReview}
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

        <TokenBalance label="Remote Balance" balance={balance} />
      </div>
    </div>
  );
}

<<<<<<< HEAD
function TokenBalance({ label, balance }: { label: string; balance?: TokenAmount | null }) {
  const value = balance?.getDecimalFormattedAmount().toFixed(5) || '0';
  return <div className="text-right text-xs text-gray-600">{`${label}: ${value}`}</div>;
}

function ButtonSection({
  isReview,
  isValidating,
  setIsReview,
  cleanOverrideToken,
  routeOverrideToken,
  warpCore,
}: {
  isReview: boolean;
  isValidating: boolean;
  setIsReview: (b: boolean) => void;
  cleanOverrideToken: () => void;
  routeOverrideToken: Token | null;
  warpCore: WarpCore;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const multiProvider = useMultiProvider();
  const chainDisplayName = useChainDisplayName(values.destination);

  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);
  const { address: connectedWallet } = getAccountAddressAndPubKey(
    multiProvider,
    values.origin,
    accounts,
  );

  // Confirming recipient address
  const [{ addressConfirmed, showWarning }, setRecipientInfos] = useState({
    showWarning: false,
    addressConfirmed: true,
  });

  useEffect(() => {
    const checkSameEVMRecipient = async (recipient: string) => {
      if (!connectedWallet) {
        // Hide warning banner if entering a recipient address and then disconnect wallet
        setRecipientInfos({ showWarning: false, addressConfirmed: true });
        return;
      }

      const { protocol: destinationProtocol } = multiProvider.getChainMetadata(values.destination);
      const { protocol: sourceProtocol } = multiProvider.getChainMetadata(values.origin);

      // Check if we are only dealing with bridging between two EVM chains
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

      // check first if the address on origin is a smart contract
      const { isContract: isSenderSmartContract, error: senderCheckError } = await isSmartContract(
        multiProvider,
        values.origin,
        connectedWallet,
      );

      const { isContract: isRecipientSmartContract, error: recipientCheckError } =
        await isSmartContract(multiProvider, values.destination, recipient);

      const isSelfRecipient = eqAddress(recipient, connectedWallet);

      // Hide warning banners if entering a recipient address and then disconnect wallet
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
    checkSameEVMRecipient(values.recipient);
  }, [
    values.recipient,
    connectedWallet,
    multiProvider,
    values.destination,
    values.origin,
    chainDisplayName,
  ]);

  const isSanctioned = useIsAccountSanctioned();

  const onDoneTransactions = () => {
    setIsReview(false);
    setTransferLoading(false);
    cleanOverrideToken();
    // resetForm();
  };
  const { triggerTransactions } = useTokenTransfer(onDoneTransactions);

  const { setTransferLoading } = useStore((s) => ({
    setTransferLoading: s.setTransferLoading,
  }));

  const triggerTransactionsHandler = async () => {
    if (isSanctioned) {
      return;
    }
    setIsReview(false);
    setTransferLoading(true);
    let tokenIndex = values.tokenIndex;
    let origin = values.origin;

    if (routeOverrideToken) {
      tokenIndex = getIndexForToken(warpCore, routeOverrideToken);
      origin = routeOverrideToken.chainName;
    }
    await triggerTransactions({ ...values, tokenIndex, origin });
  };

  const onEdit = () => {
    setIsReview(false);
    cleanOverrideToken();
  };

  if (!isReview) {
    return (
      <>
        <div
          className={`mt-3 gap-2 bg-amber-400 px-4 text-sm ${
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
          disabled={!addressConfirmed}
          chainName={values.origin}
          text={isValidating ? 'Validating...' : 'Continue'}
          classes={`${isReview ? 'mt-4' : 'mt-0'} px-3 py-1.5`}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`mt-3 gap-2 bg-amber-400 px-4 text-sm ${
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
      <div className="mt-4 flex items-center justify-between space-x-4">
        <SolidButton
          type="button"
          color="primary"
          onClick={onEdit}
          className="px-6 py-1.5"
          icon={<ChevronIcon direction="w" width={10} height={6} color={Color.white} />}
        >
          <span>Edit</span>
        </SolidButton>
        <SolidButton
          disabled={!addressConfirmed}
          type="button"
          color="accent"
          onClick={triggerTransactionsHandler}
          className="flex-1 px-3 py-1.5"
        >
          {`Send to ${chainDisplayName}`}
        </SolidButton>
      </div>
    </>
  );
}

function MaxButton({ balance, disabled }: { balance?: TokenAmount; disabled?: boolean }) {
=======
function MaxButton({
  balance,
  disabled,
  isRouteSupported,
}: {
  balance?: TokenAmount;
  disabled?: boolean;
  isRouteSupported: boolean;
}) {
>>>>>>> origin/main
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { originTokenKey, destinationTokenKey } = values;
  const tokenMap = useTokenByKeyMap();
  const originToken = getTokenByKeyFromMap(tokenMap, originTokenKey);
  const destinationToken = getTokenByKeyFromMap(tokenMap, destinationTokenKey);
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
      destinationToken,
      accounts,
      recipient: values.recipient,
    });
    if (isNullish(maxAmount)) return;
    const decimalsAmount = maxAmount.getDecimalFormattedAmount();
    const roundedAmount = new BigNumber(decimalsAmount).toFixed(4, BigNumber.ROUND_FLOOR);
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

<<<<<<< HEAD
=======
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
  const tokenMap = useTokenByKeyMap();
  const originToken = routeOverrideToken || getTokenByKeyFromMap(tokenMap, values.originTokenKey);
  const destinationToken = getTokenByKeyFromMap(tokenMap, values.destinationTokenKey);
  const chainDisplayName = useChainDisplayName(destinationToken?.chainName || '');
  const isRouteSupported = useIsRouteSupported();

  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);
  const { address: connectedWallet } = getAccountAddressAndPubKey(
    multiProvider,
    originToken?.chainName,
    accounts,
  );

  // Get recipient (form value or fallback to connected wallet for destination)
  const { address: connectedDestAddress } = getAccountAddressAndPubKey(
    multiProvider,
    destinationToken?.chainName,
    accounts,
  );
  const recipient = values.recipient || connectedDestAddress || '';

  // Confirming recipient address
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

    await triggerTransactions(values, routeOverrideToken);
    setTransferLoading(false);
  };

  const onEdit = () => {
    setIsReview(false);
    cleanOverrideToken();
  };

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
          {`Send to ${chainDisplayName}`}
        </SolidButton>
      </div>
    </>
  );
}

>>>>>>> origin/main
function ReviewDetails({
  isReview,
  routeOverrideToken,
}: {
  isReview: boolean;
  routeOverrideToken: Token | null;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const warpCore = useWarpCore();
<<<<<<< HEAD
  const originToken = routeOverrideToken || getTokenByIndex(warpCore, tokenIndex);
=======
  const { amount, originTokenKey, destinationTokenKey } = values;
  const tokenMap = useTokenByKeyMap();
  const originTokenByKey = routeOverrideToken || getTokenByKeyFromMap(tokenMap, originTokenKey);
  const destinationTokenByKey = getTokenByKeyFromMap(tokenMap, destinationTokenKey);
  // Finding actual token pair for the given tokens
  const originToken =
    destinationTokenByKey && originTokenByKey
      ? findRouteToken(warpCore, originTokenByKey, destinationTokenByKey)
      : undefined;
  const destinationToken = destinationTokenByKey
    ? originToken?.getConnectionForChain(destinationTokenByKey.chainName)?.token
    : undefined;
>>>>>>> origin/main
  const originTokenSymbol = originToken?.symbol || '';
  const isNft = originToken?.isNft();
  const isRouteSupported = useIsRouteSupported();

  const scaledAmount = useMemo(() => {
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
  }, [amount, originToken, destinationToken, isReview]);

  const scaledAmount = useMemo(() => {
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
  }, [amount, originToken, destinationToken, isReview]);

  const amountWei = isNft ? amount.toString() : toWei(amount, originToken?.decimals);

  const { isLoading: isApproveLoading, isApproveRequired } = useIsApproveRequired(
    originToken,
    amountWei,
    isReview,
  );
<<<<<<< HEAD
  const { isLoading: isQuoteLoading, fees: feeQuotes } = useFeeQuotes(
    values,
    true,
    originToken,
=======
  // Only fetch fees if route is supported
  const { isLoading: isQuoteLoading, fees: feeQuotes } = useFeeQuotes(
    values,
    isRouteSupported,
    originToken,
    destinationToken,
>>>>>>> origin/main
    !isReview,
  );

  const { prices } = useTokenPrices();
  const feePrices = useFeePrices(feeQuotes ?? null, warpCore.tokens, prices);
  const tokenPrice = originToken?.coinGeckoId ? prices[originToken.coinGeckoId] : undefined;
  const parsedAmount = parseFloat(amount);
  const transferUsd = tokenPrice && !isNaN(parsedAmount) ? parsedAmount * tokenPrice : 0;
  const isLoading = isApproveLoading || isQuoteLoading;

  const fees = useMemo(() => {
    if (!feeQuotes) return null;

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
  }, [feeQuotes, originToken]);

  return (
    <>
<<<<<<< HEAD
      {!isReview && <FeeSectionButton visible={!isReview} fees={fees} isLoading={isLoading} />}
=======
      {!isReview && (
        <FeeSectionButton
          fees={fees}
          isLoading={isLoading}
          feePrices={feePrices}
          transferUsd={transferUsd}
        />
      )}
>>>>>>> origin/main

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
<<<<<<< HEAD
                      <span>{`${fees.localQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                        fees.localQuote.token.symbol || ''
                      }`}</span>
=======
                      <span>
                        {`${fees.localQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${fees.localQuote.token.symbol || ''}`}
                        <UsdLabel tokenAmount={fees.localQuote} feePrices={feePrices} />
                      </span>
>>>>>>> origin/main
                    </p>
                  )}
                  {fees?.interchainQuote && fees.interchainQuote.amount > 0n && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Interchain Gas</span>
<<<<<<< HEAD
                      <span>{`${fees.interchainQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                        fees.interchainQuote.token.symbol || ''
                      }`}</span>
=======
                      <span>
                        {`${fees.interchainQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${fees.interchainQuote.token.symbol || ''}`}
                        <UsdLabel tokenAmount={fees.interchainQuote} feePrices={feePrices} />
                      </span>
>>>>>>> origin/main
                    </p>
                  )}
                  {fees?.tokenFeeQuote && fees.tokenFeeQuote.amount > 0n && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Token Fee</span>
<<<<<<< HEAD
                      <span>{`${fees.tokenFeeQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                        fees.tokenFeeQuote.token.symbol || ''
                      }`}</span>
=======
                      <span>
                        {`${fees.tokenFeeQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${fees.tokenFeeQuote.token.symbol || ''}`}
                        <UsdLabel tokenAmount={fees.tokenFeeQuote} feePrices={feePrices} />
                      </span>
>>>>>>> origin/main
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
  const tokenMap = useTokenByKeyMap();
  const originToken = getTokenByKeyFromMap(tokenMap, values.originTokenKey);
  const destinationToken = getTokenByKeyFromMap(tokenMap, values.destinationTokenKey);

  return (
    // Max height to prevent double padding if multiple warnings are visible
    <div className="max-h-10">
<<<<<<< HEAD
      <ChainWalletWarning origin={values.origin} />
      <ChainConnectionWarning origin={values.origin} destination={values.destination} />
      <WalletConnectionWarning origin={values.origin} />
=======
      <ChainWalletWarning origin={originToken?.chainName || ''} />
      <ChainConnectionWarning
        origin={originToken?.chainName || ''}
        destination={destinationToken?.chainName || ''}
      />
      <WalletConnectionWarning origin={originToken?.chainName || ''} />
>>>>>>> origin/main
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

function useIsRouteSupported(): boolean {
  const { values } = useFormikContext<TransferFormValues>();
  const tokenMap = useTokenByKeyMap();
  const collateralGroups = useCollateralGroups();
  const originToken = getTokenByKeyFromMap(tokenMap, values.originTokenKey);
  const destinationToken = getTokenByKeyFromMap(tokenMap, values.destinationTokenKey);

  return useMemo(() => {
    if (!originToken || !destinationToken) return true;
    return checkTokenHasRoute(originToken, destinationToken, collateralGroups);
  }, [originToken, destinationToken, collateralGroups]);
}

const insufficientFundsErrMsg = /insufficient.(funds|lamports)/i;
const emptyAccountErrMsg = /AccountNotFound/i;

async function validateForm(
  warpCore: WarpCore,
  tokenMap: Map<string, Token>,
  collateralGroups: Map<string, Token[]>,
  values: TransferFormValues,
<<<<<<< HEAD
  accounts: Record<ProtocolType, AccountInfo>,
  routerAddressesByChainMap: Record<ChainName, Set<string>>,
=======
  accounts: Record<KnownProtocolType, AccountInfo>,
  routerAddressesByChainMap: Record<ChainName, Record<string, RouterAddressInfo>>,
>>>>>>> origin/main
): Promise<[Record<string, string> | null, Token | null]> {
  // returns a tuple, where first value is validation result
  // and second value is token override
  try {
<<<<<<< HEAD
    const { origin, destination, tokenIndex, amount, recipient } = values;
    const token = getTokenByIndex(warpCore, tokenIndex);
    if (!token) return [{ token: 'Token is required' }, null];
    const destinationToken = token.getConnectionForChain(destination)?.token;
    if (!destinationToken) return [{ token: 'Token is required' }, null];

    if (
      objKeys(routerAddressesByChainMap).includes(destination) &&
      routerAddressesByChainMap[destination].has(recipient)
    ) {
      return [{ recipient: 'Warp Route address is not valid as recipient' }, null];
    }

    const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
      warpCore.multiProvider,
      origin,
      accounts,
    );
    const amountWei = toWei(amount, token.decimals);
    const transferToken = await getLowestFeeTransferToken(
=======
    const { originTokenKey, destinationTokenKey, amount, recipient: formRecipient } = values;

    // Look up tokens from the pre-computed map
    const token = getTokenByKeyFromMap(tokenMap, originTokenKey);
    const destinationToken = getTokenByKeyFromMap(tokenMap, destinationTokenKey);

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

    if (routerAddressesByChainMap[destination]?.[normalizeAddress(recipient)]) {
      return [{ recipient: 'Warp Route address is not valid as recipient' }, null];
    }

    const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
      warpCore.multiProvider,
      token.chainName,
      accounts,
    );

    const amountWei = toWei(amount, token.decimals);
    const transferToken = await getTransferToken(
>>>>>>> origin/main
      warpCore,
      token,
      destinationToken,
      amountWei,
      recipient,
      sender,
<<<<<<< HEAD
    );
    const multiCollateralLimit = isMultiCollateralLimitExceeded(token, destination, amountWei);

    if (multiCollateralLimit) {
      return [
        {
          amount: `Transfer limit is ${fromWei(multiCollateralLimit.toString(), token.decimals)} ${token.symbol}`,
        },
        null,
      ];
=======
      defaultMultiCollateralRoutes,
    );

    // This should not happen since we already checked the route above, but keep as safety check
    const connection = transferToken.getConnectionForChain(destination);
    if (!connection) {
      return [{ destinationTokenKey: 'Route is not supported' }, null];
>>>>>>> origin/main
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

    const originTokenAmount = transferToken.amount(amountWei);
    const result = await warpCore.validateTransfer({
<<<<<<< HEAD
      originTokenAmount: transferToken.amount(amountWei),
=======
      originTokenAmount,
>>>>>>> origin/main
      destination,
      recipient,
      sender: sender || '',
      senderPubKey: await senderPubKey,
    });

<<<<<<< HEAD
    if (!isNullish(result)) return [result, null];
=======
    if (!isNullish(result)) {
      const enriched = await enrichBalanceError(
        warpCore,
        result,
        originTokenAmount,
        destination,
        sender || '',
        recipient,
      );
      return [enriched, null];
    }
>>>>>>> origin/main

    if (transferToken.addressOrDenom === token.addressOrDenom) return [null, null];

    return [null, transferToken];
  } catch (error: any) {
    logger.error('Error validating form', error);
    let errorMsg = errorToString(error, 40);
    const fullError = `${errorMsg} ${error.message}`;
    if (insufficientFundsErrMsg.test(fullError) || emptyAccountErrMsg.test(fullError)) {
      const originToken = getTokenByKeyFromMap(tokenMap, values.originTokenKey);
      const chainMetadata = originToken
        ? warpCore.multiProvider.tryGetChainMetadata(originToken.chainName)
        : null;
      const symbol = chainMetadata?.nativeToken?.symbol || 'funds';
      errorMsg = `Insufficient ${symbol} for gas fees`;
    }
    return [{ form: errorMsg }, null];
  }
}

const igpErrorPattern = /^Insufficient (\S+) for interchain gas$/;

async function enrichBalanceError(
  warpCore: WarpCore,
  result: Record<string, string>,
  originTokenAmount: TokenAmount,
  destination: string,
  sender: string,
  recipient: string,
): Promise<Record<string, string>> {
  if (!result.amount) return result;
  const igpErrorMatch = igpErrorPattern.exec(result.amount);
  if (!igpErrorMatch) return result;

  try {
    const { igpQuote } = await warpCore.getInterchainTransferFee({
      originTokenAmount,
      destination,
      sender,
      recipient,
    });

    // Symbol in validateTransfer message is sourced from igpQuote.token.symbol.
    if (igpErrorMatch[1] !== igpQuote.token.symbol) return result;

    const balance = originTokenAmount.token.isFungibleWith(igpQuote.token)
      ? await originTokenAmount.token.getBalance(warpCore.multiProvider, sender)
      : await igpQuote.token.getBalance(warpCore.multiProvider, sender);
    const deficit = igpQuote.amount - balance.amount;
    if (deficit > 0n) {
      const deficitAmount = new TokenAmount(deficit, igpQuote.token);
      return {
        ...result,
        amount: `Insufficient ${igpQuote.token.symbol} for interchain gas (need ${deficitAmount.getDecimalFormattedAmount().toFixed(4)} more ${igpQuote.token.symbol})`,
      };
    }
  } catch (e) {
    logger.warn('Failed to enrich balance error', e);
  }
  return result;
}
