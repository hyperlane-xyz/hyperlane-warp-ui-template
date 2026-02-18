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
  normalizeAddress,
  toWei,
} from '@hyperlane-xyz/utils';
import {
  AccountInfo,
  ChevronIcon,
  IconButton,
  SpinnerIcon,
  SwapIcon,
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
import { TextField } from '../../components/input/TextField';
import {
  TIP_CARD_ACTION_ADDRESS_OR_DENOM,
  TIP_CARD_ACTION_DESTINATION,
  TIP_CARD_ACTION_ORIGIN,
} from '../../components/tip/const';
import { WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { Color } from '../../styles/Color';
import { logger } from '../../utils/logger';
import { getQueryParams, updateQueryParam, updateQueryParams } from '../../utils/queryParams';
import { trackTransactionFailedEvent } from '../analytics/utils';
import { ChainConnectionWarning } from '../chains/ChainConnectionWarning';
import { ChainSelectField } from '../chains/ChainSelectField';
import { ChainWalletWarning } from '../chains/ChainWalletWarning';
import { useChainDisplayName, useMultiProvider } from '../chains/hooks';
import { getNumRoutesWithSelectedChain, tryGetValidChainName } from '../chains/utils';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { useIsAccountSanctioned } from '../sanctions/hooks/useIsAccountSanctioned';
import { RouterAddressInfo, useStore } from '../store';
import { SelectOrInputTokenIds } from '../tokens/SelectOrInputTokenIds';
import { TokenSelectField } from '../tokens/TokenSelectField';
import { useIsApproveRequired } from '../tokens/approval';
import {
  getDestinationNativeBalance,
  useDestinationBalance,
  useOriginBalance,
} from '../tokens/balances';
import {
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
import { getInterchainQuote, getTotalFee, getTransferToken } from './fees';
import { useFetchMaxAmount } from './maxAmount';
import { TransferFormValues } from './types';
import { useRecipientBalanceWatcher } from './useBalanceWatcher';
import { useFeeQuotes } from './useFeeQuotes';
import { useTokenTransfer } from './useTokenTransfer';
import { isSmartContract } from './utils';

export function TransferTokenForm() {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const { originChainName, setOriginChainName, routerAddressesByChainMap } = useStore((s) => ({
    originChainName: s.originChainName,
    setOriginChainName: s.setOriginChainName,
    routerAddressesByChainMap: s.routerAddressesByChainMap,
  }));

  const initialValues = useFormInitialValues();
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);

  if (!originChainName) {
    setOriginChainName(initialValues.origin);
  }

  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);
  // Flag for check current type of token
  const [isNft, setIsNft] = useState(false);
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
    logger.debug('Checking destination native balance for:', values.destination, values.recipient);
    const balance = await getDestinationNativeBalance(multiProvider, values);
    if (isNullish(balance)) return;
    else if (balance > 0n) {
      logger.debug('Reviewing transfer form values for:', values.origin, values.destination);
      setIsReview(true);
    } else {
      logger.debug('Recipient has no balance on destination. Confirming address.');
      openConfirmationModal();
    }
  };

  useEffect(() => {
    if (!originChainName) setOriginChainName(initialValues.origin);
  }, [initialValues.origin, originChainName, setOriginChainName]);

  return (
    <Formik<TransferFormValues>
      initialValues={initialValues}
      onSubmit={onSubmitForm}
      validate={validate}
      validateOnChange={false}
      validateOnBlur={false}
    >
      {({ isValidating }) => (
        <Form className="flex w-full flex-col items-stretch">
          <WarningBanners />
          <ChainSelectSection isReview={isReview} />
          <div className="mt-2.5 flex items-end justify-between space-x-4">
            <TokenSection setIsNft={setIsNft} isReview={isReview} />
            <AmountSection isNft={isNft} isReview={isReview} />
          </div>
          <RecipientSection isReview={isReview} />
          <ReviewDetails isReview={isReview} routeOverrideToken={routeOverrideToken} />
          <ButtonSection
            isReview={isReview}
            isValidating={isValidating}
            setIsReview={setIsReview}
            cleanOverrideToken={() => setRouteTokenOverride(null)}
            routeOverrideToken={routeOverrideToken}
            warpCore={warpCore}
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

function SwapChainsButton({
  disabled,
  onSwapChain,
}: {
  disabled?: boolean;
  onSwapChain: (origin: string, destination: string) => void;
}) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { origin, destination } = values;

  const onClick = () => {
    if (disabled) return;
    setFieldValue('origin', destination);
    setFieldValue('destination', origin);
    // Reset other fields on chain change
    setFieldValue('recipient', '');
    onSwapChain(destination, origin);
  };

  return (
    <IconButton
      width={20}
      height={20}
      title="Swap chains"
      className={!disabled ? 'hover:rotate-180' : undefined}
      onClick={onClick}
      disabled={disabled}
    >
      <SwapIcon width={20} height={20} />
    </IconButton>
  );
}

function ChainSelectSection({ isReview }: { isReview: boolean }) {
  const warpCore = useWarpCore();

  const { setOriginChainName, isTipCardActionTriggered, setIsTipCardActionTriggered } = useStore(
    (s) => ({
      setOriginChainName: s.setOriginChainName,
      setIsTipCardActionTriggered: s.setIsTipCardActionTriggered,
      isTipCardActionTriggered: s.isTipCardActionTriggered,
    }),
  );

  const { values, setFieldValue, setValues } = useFormikContext<TransferFormValues>();

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
    }
    updateQueryParam(fieldName, chainName);
  };

  const onSwapChain = (origin: string, destination: string) => {
    updateQueryParam(WARP_QUERY_PARAMS.ORIGIN, origin);
    updateQueryParam(WARP_QUERY_PARAMS.DESTINATION, destination);
    setTokenOnChainChange(origin, destination);
    setOriginChainName(origin);
  };

  const onTipCardActionTriggered = useCallback(() => {
    const tokenIndex = getTokenIndexFromChains(
      warpCore,
      TIP_CARD_ACTION_ADDRESS_OR_DENOM,
      TIP_CARD_ACTION_ORIGIN,
      TIP_CARD_ACTION_DESTINATION,
    );
    setValues((prevValues) => ({
      ...prevValues,
      origin: TIP_CARD_ACTION_ORIGIN,
      destination: TIP_CARD_ACTION_DESTINATION,
      tokenIndex,
    }));
    updateQueryParams({
      [WARP_QUERY_PARAMS.ORIGIN]: TIP_CARD_ACTION_ORIGIN,
      [WARP_QUERY_PARAMS.DESTINATION]: TIP_CARD_ACTION_DESTINATION,
      [WARP_QUERY_PARAMS.TOKEN]: TIP_CARD_ACTION_ADDRESS_OR_DENOM,
    });
  }, [setValues, warpCore]);

  useEffect(() => {
    if (!isTipCardActionTriggered) return;

    onTipCardActionTriggered();
    setIsTipCardActionTriggered(false);
  }, [isTipCardActionTriggered, onTipCardActionTriggered, setIsTipCardActionTriggered]);

  return (
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
    </div>
  );
}

function TokenSection({
  setIsNft,
  isReview,
}: {
  setIsNft: (b: boolean) => void;
  isReview: boolean;
}) {
  return (
    <div className="flex-1">
      <label htmlFor="tokenIndex" className="block pl-0.5 font-secondary text-sm text-gray-600">
        Token
      </label>
      <TokenSelectField name="tokenIndex" disabled={isReview} setIsNft={setIsNft} />
    </div>
  );
}

function AmountSection({ isNft, isReview }: { isNft: boolean; isReview: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  const { balance } = useOriginBalance(values);
  const { tokenPrice, isLoading } = useTokenPrice(values);

  const amount = parseFloat(values.amount);
  const totalTokenPrice = !isNullish(tokenPrice) && !isNaN(amount) ? amount * tokenPrice : 0;
  const shouldShowPrice = totalTokenPrice >= 0.01;

  return (
    <div className="flex-1">
      <div className="flex justify-between pr-1">
        <label htmlFor="amount" className="block pl-0.5 font-secondary text-sm text-gray-600">
          Amount
        </label>
        <TokenBalance label="My balance" balance={balance} />
      </div>
      {isNft ? (
        <SelectOrInputTokenIds disabled={isReview} />
      ) : (
        <div className="relative w-full">
          <TextField
            name="amount"
            placeholder="0.00"
            className="w-full"
            type="number"
            step="any"
            disabled={isReview}
          />
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
        </div>
      )}
    </div>
  );
}

function RecipientSection({ isReview }: { isReview: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  const { balance } = useDestinationBalance(values);
  useRecipientBalanceWatcher(values.recipient, balance);

  return (
    <div className="mt-4">
      <div className="flex justify-between pr-1">
        <label htmlFor="recipient" className="block pl-0.5 font-secondary text-sm text-gray-600">
          Recipient address
        </label>
        <TokenBalance label="Remote balance" balance={balance} />
      </div>
      <div className="relative w-full">
        <TextField
          name="recipient"
          placeholder="0x123456..."
          className="w-full"
          disabled={isReview}
        />
        <SelfButton disabled={isReview} />
      </div>
    </div>
  );
}

function TokenBalance({ label, balance }: { label: string; balance?: TokenAmount | null }) {
  const value =
    balance?.getDecimalFormattedAmount().toLocaleString('en-US', {
      maximumFractionDigits: 6,
      useGrouping: false,
    }) || '0';
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

  const { setTransferLoading } = useStore((s) => ({
    setTransferLoading: s.setTransferLoading,
  }));

  const onDoneTransactions = () => {
    setIsReview(false);
    setTransferLoading(false);
    cleanOverrideToken();
    // resetForm();
  };
  const { triggerTransactions } = useTokenTransfer(onDoneTransactions);

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
          classes={`${isReview ? 'mt-4' : 'mt-0'} px-3 py-1.5 font-secondary`}
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
          className="px-6 py-1.5 font-secondary"
          icon={<ChevronIcon direction="w" width={10} height={6} color={Color.white} />}
        >
          <span>Edit</span>
        </SolidButton>
        <SolidButton
          disabled={!addressConfirmed}
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

function MaxButton({ balance, disabled }: { balance?: TokenAmount; disabled?: boolean }) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { origin, destination, tokenIndex } = values;
  const multiProvider = useMultiProvider();
  const { accounts } = useAccounts(multiProvider);
  const { fetchMaxAmount, isLoading } = useFetchMaxAmount();

  const onClick = async () => {
    if (!balance || isNullish(tokenIndex) || disabled) return;
    const maxAmount = await fetchMaxAmount({ balance, origin, destination, accounts });
    if (isNullish(maxAmount)) return;
    const decimalsAmount = maxAmount.getDecimalFormattedAmount();
    const roundedAmount = new BigNumber(decimalsAmount).toFixed(8, BigNumber.ROUND_FLOOR);
    const trimmedAmount = roundedAmount.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    setFieldValue('amount', trimmedAmount);
  };

  return (
    <SolidButton
      type="button"
      onClick={onClick}
      color="primary"
      disabled={disabled}
      className="absolute bottom-1 right-1 top-2.5 px-2 text-xs opacity-90 all:rounded"
    >
      {isLoading ? (
        <div className="flex items-center">
          <SpinnerIcon className="h-5 w-5" color="white" />
        </div>
      ) : (
        'Max'
      )}
    </SolidButton>
  );
}

function SelfButton({ disabled }: { disabled?: boolean }) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const multiProvider = useMultiProvider();
  const chainDisplayName = useChainDisplayName(values.destination);
  const address = useAccountAddressForChain(multiProvider, values.destination);
  const onClick = () => {
    if (disabled) return;
    if (address) setFieldValue('recipient', address);
    else
      toast.warn(`No account found for for chain ${chainDisplayName}, is your wallet connected?`);
  };
  return (
    <SolidButton
      type="button"
      onClick={onClick}
      color="primary"
      disabled={disabled}
      className="absolute bottom-1 right-1 top-2.5 px-2 text-xs opacity-90 all:rounded"
    >
      Self
    </SolidButton>
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
  const { amount, destination, tokenIndex } = values;
  const warpCore = useWarpCore();
  const originToken = routeOverrideToken || getTokenByIndex(warpCore, tokenIndex);
  const originTokenSymbol = originToken?.symbol || '';
  const connection = originToken?.getConnectionForChain(destination);
  const destinationToken = connection?.token;
  const isNft = originToken?.isNft();

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
  const { isLoading: isQuoteLoading, fees: feeQuotes } = useFeeQuotes(
    values,
    true,
    originToken,
    !isReview,
  );

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
      {!isReview && <FeeSectionButton visible={!isReview} fees={fees} isLoading={isLoading} />}

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
  return (
    // Max height to prevent double padding if multiple warnings are visible
    <div className="max-h-10">
      <ChainWalletWarning origin={values.origin} />
      <ChainConnectionWarning origin={values.origin} destination={values.destination} />
      <WalletConnectionWarning origin={values.origin} />
    </div>
  );
}

function useFormInitialValues(): TransferFormValues {
  const warpCore = useWarpCore();
  const params = getQueryParams();

  const originQuery = tryGetValidChainName(
    params.get(WARP_QUERY_PARAMS.ORIGIN),
    warpCore.multiProvider,
  );
  const destinationQuery = tryGetValidChainName(
    params.get(WARP_QUERY_PARAMS.DESTINATION),
    warpCore.multiProvider,
  );
  const defaultOriginToken = config.defaultOriginChain
    ? warpCore.getTokensForChain(config.defaultOriginChain)?.[0]
    : undefined;

  const tokenIndex = getInitialTokenIndex(
    warpCore,
    params.get(WARP_QUERY_PARAMS.TOKEN),
    originQuery,
    destinationQuery,
    defaultOriginToken,
    config.defaultDestinationChain,
  );

  return useMemo(() => {
    const firstToken = defaultOriginToken || warpCore.tokens[0];
    const connectedToken = firstToken.connections?.[0];
    const chainsValid = originQuery && destinationQuery;

    return {
      origin: chainsValid ? originQuery : firstToken.chainName,
      destination: chainsValid
        ? destinationQuery
        : config.defaultDestinationChain || connectedToken?.token?.chainName || '',
      tokenIndex: tokenIndex,
      amount: '',
      recipient: '',
    };
  }, [warpCore, destinationQuery, originQuery, tokenIndex, defaultOriginToken]);
}

const insufficientFundsErrMsg = /insufficient.[funds|lamports]/i;
const emptyAccountErrMsg = /AccountNotFound/i;

async function validateForm(
  warpCore: WarpCore,
  values: TransferFormValues,
  accounts: Record<KnownProtocolType, AccountInfo>,
  routerAddressesByChainMap: Record<ChainName, Record<string, RouterAddressInfo>>,
): Promise<[Record<string, string> | null, Token | null]> {
  // returns a tuple, where first value is validation result
  // and second value is token override
  try {
    const { origin, destination, tokenIndex, amount, recipient } = values;
    const token = getTokenByIndex(warpCore, tokenIndex);
    if (!token) return [{ token: 'Token is required' }, null];
    const destinationToken = token.getConnectionForChain(destination)?.token;
    if (!destinationToken) return [{ token: 'Token is required' }, null];

    if (routerAddressesByChainMap[destination]?.[normalizeAddress(recipient)]) {
      return [{ recipient: 'Warp Route address is not valid as recipient' }, null];
    }

    const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
      warpCore.multiProvider,
      origin,
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
      const chainMetadata = warpCore.multiProvider.getChainMetadata(values.origin);
      const nativeToken = Token.FromChainMetadataNativeToken(chainMetadata);
      errorMsg = `Insufficient ${nativeToken.symbol} for gas fees`;
    }
    return [{ form: errorMsg }, null];
  }
}
