import { TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import { ProtocolType, errorToString, isNullish, toWei } from '@hyperlane-xyz/utils';
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
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { SolidButton } from '../../components/buttons/SolidButton';
import { TextField } from '../../components/input/TextField';
import { WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { Color } from '../../styles/Color';
import { logger } from '../../utils/logger';
import { getQueryParams, updateQueryParam } from '../../utils/queryParams';
import { ChainConnectionWarning } from '../chains/ChainConnectionWarning';
import { ChainSelectField } from '../chains/ChainSelectField';
import { ChainWalletWarning } from '../chains/ChainWalletWarning';
import { useChainDisplayName, useMultiProvider } from '../chains/hooks';
import { getNumRoutesWithSelectedChain, tryGetValidChainName } from '../chains/utils';
import { useIsAccountSanctioned } from '../sanctions/hooks/useIsAccountSanctioned';
import { useStore } from '../store';
import { SelectOrInputTokenIds } from '../tokens/SelectOrInputTokenIds';
import { TokenSelectField } from '../tokens/TokenSelectField';
import { useIsApproveRequired } from '../tokens/approval';
import {
  getDestinationNativeBalance,
  useDestinationBalance,
  useOriginBalance,
} from '../tokens/balances';
import {
  getInitialTokenIndex,
  getTokenByIndex,
  getTokenIndexFromChains,
  useWarpCore,
} from '../tokens/hooks';
import { RecipientConfirmationModal } from './RecipientConfirmationModal';
import { useFetchMaxAmount } from './maxAmount';
import { TransferFormValues } from './types';
import { useRecipientBalanceWatcher } from './useBalanceWatcher';
import { useFeeQuotes } from './useFeeQuotes';
import { useTokenTransfer } from './useTokenTransfer';

export function TransferTokenForm() {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const { originChainName, setOriginChainName } = useStore((s) => ({
    originChainName: s.originChainName,
    setOriginChainName: s.setOriginChainName,
  }));

  const initialValues = useFormInitialValues();
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);

  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);
  // Flag for check current type of token
  const [isNft, setIsNft] = useState(false);
  // Modal for confirming address
  const {
    open: openConfirmationModal,
    close: closeConfirmationModal,
    isOpen: isConfirmationModalOpen,
  } = useModal();

  const validate = (values: TransferFormValues) => validateForm(warpCore, values, accounts);

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
          <div className="mt-3.5 flex items-end justify-between space-x-4">
            <TokenSection setIsNft={setIsNft} isReview={isReview} />
            <AmountSection isNft={isNft} isReview={isReview} />
          </div>
          <RecipientSection isReview={isReview} />
          <ReviewDetails visible={isReview} />
          <ButtonSection
            isReview={isReview}
            isValidating={isValidating}
            setIsReview={setIsReview}
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

  const { setOriginChainName } = useStore((s) => ({
    setOriginChainName: s.setOriginChainName,
  }));

  const { values, setFieldValue } = useFormikContext<TransferFormValues>();

  const originRouteCounts = useMemo(() => {
    return getNumRoutesWithSelectedChain(warpCore, values.origin, true);
  }, [values.origin, warpCore]);

  const destinationRouteCounts = useMemo(() => {
    return getNumRoutesWithSelectedChain(warpCore, values.destination, false);
  }, [values.destination, warpCore]);

  const setTokenOnChainChange = (origin: string, destination: string) => {
    const tokenIndex = getTokenIndexFromChains(warpCore, null, origin, destination);
    const token = getTokenByIndex(warpCore, tokenIndex);
    updateQueryParam(WARP_QUERY_PARAMS.TOKEN, token?.addressOrDenom);
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

  return (
    <div className="mt-2 flex items-center justify-between gap-4">
      <ChainSelectField
        name="origin"
        label="From"
        disabled={isReview}
        customListItemField={destinationRouteCounts}
        onChange={handleChange}
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
      <label htmlFor="tokenIndex" className="block pl-0.5 text-sm text-gray-600">
        Token
      </label>
      <TokenSelectField name="tokenIndex" disabled={isReview} setIsNft={setIsNft} />
    </div>
  );
}

function AmountSection({ isNft, isReview }: { isNft: boolean; isReview: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  const { balance } = useOriginBalance(values);

  return (
    <div className="flex-1">
      <div className="flex justify-between pr-1">
        <label htmlFor="amount" className="block pl-0.5 text-sm text-gray-600">
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
        <label htmlFor="recipient" className="block pl-0.5 text-sm text-gray-600">
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
  const value = balance?.getDecimalFormattedAmount().toFixed(5) || '0';
  return <div className="text-right text-xs text-gray-600">{`${label}: ${value}`}</div>;
}

function ButtonSection({
  isReview,
  isValidating,
  setIsReview,
}: {
  isReview: boolean;
  isValidating: boolean;
  setIsReview: (b: boolean) => void;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const chainDisplayName = useChainDisplayName(values.destination);

  const isSanctioned = useIsAccountSanctioned();

  const onDoneTransactions = () => {
    setIsReview(false);
    setTransferLoading(false);
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
    await triggerTransactions(values);
  };

  if (!isReview) {
    return (
      <ConnectAwareSubmitButton
        chainName={values.origin}
        text={isValidating ? 'Validating...' : 'Continue'}
        classes="mt-4 px-3 py-1.5"
      />
    );
  }

  return (
    <div className="mt-4 flex items-center justify-between space-x-4">
      <SolidButton
        type="button"
        color="primary"
        onClick={() => setIsReview(false)}
        className="px-6 py-1.5"
        icon={<ChevronIcon direction="w" width={10} height={6} color={Color.white} />}
      >
        <span>Edit</span>
      </SolidButton>
      <SolidButton
        type="button"
        color="accent"
        onClick={triggerTransactionsHandler}
        className="flex-1 px-3 py-1.5"
      >
        {`Send to ${chainDisplayName}`}
      </SolidButton>
    </div>
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
    const roundedAmount = new BigNumber(decimalsAmount).toFixed(4, BigNumber.ROUND_FLOOR);
    setFieldValue('amount', roundedAmount);
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

function ReviewDetails({ visible }: { visible: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  const { amount, destination, tokenIndex } = values;
  const warpCore = useWarpCore();
  const originToken = getTokenByIndex(warpCore, tokenIndex);
  const originTokenSymbol = originToken?.symbol || '';
  const connection = originToken?.getConnectionForChain(destination);
  const destinationToken = connection?.token;
  const isNft = originToken?.isNft();

  const amountWei = isNft ? amount.toString() : toWei(amount, originToken?.decimals);

  const { isLoading: isApproveLoading, isApproveRequired } = useIsApproveRequired(
    originToken,
    amountWei,
    visible,
  );
  const { isLoading: isQuoteLoading, fees } = useFeeQuotes(values, visible);

  const isLoading = isApproveLoading || isQuoteLoading;

  return (
    <div
      className={`${
        visible ? 'max-h-screen duration-1000 ease-in' : 'max-h-0 duration-500'
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
                    <span className="min-w-[6.5rem]">Remote Token</span>
                    <span>{destinationToken.addressOrDenom}</span>
                  </p>
                )}
                <p className="flex">
                  <span className="min-w-[6.5rem]">{isNft ? 'Token ID' : 'Amount'}</span>
                  <span>{`${amount} ${originTokenSymbol}`}</span>
                </p>
                {fees?.localQuote && fees.localQuote.amount > 0n && (
                  <p className="flex">
                    <span className="min-w-[6.5rem]">Local Gas (est.)</span>
                    <span>{`${fees.localQuote.getDecimalFormattedAmount().toFixed(4) || '0'} ${
                      fees.localQuote.token.symbol || ''
                    }`}</span>
                  </p>
                )}
                {fees?.interchainQuote && fees.interchainQuote.amount > 0n && (
                  <p className="flex">
                    <span className="min-w-[6.5rem]">Interchain Gas</span>
                    <span>{`${fees.interchainQuote.getDecimalFormattedAmount().toFixed(4) || '0'} ${
                      fees.interchainQuote.token.symbol || ''
                    }`}</span>
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WarningBanners() {
  const { values } = useFormikContext<TransferFormValues>();
  return (
    // Max height to prevent double padding if multiple warnings are visible
    <div className="max-h-10">
      <ChainWalletWarning origin={values.origin} />
      <ChainConnectionWarning origin={values.origin} destination={values.destination} />
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
  accounts: Record<ProtocolType, AccountInfo>,
) {
  try {
    const { origin, destination, tokenIndex, amount, recipient } = values;
    const token = getTokenByIndex(warpCore, tokenIndex);
    if (!token) return { token: 'Token is required' };
    const amountWei = toWei(amount, token.decimals);
    const { address, publicKey: senderPubKey } = getAccountAddressAndPubKey(
      warpCore.multiProvider,
      origin,
      accounts,
    );
    const result = await warpCore.validateTransfer({
      originTokenAmount: token.amount(amountWei),
      destination,
      recipient,
      sender: address || '',
      senderPubKey: await senderPubKey,
    });
    return result;
  } catch (error: any) {
    logger.error('Error validating form', error);
    let errorMsg = errorToString(error, 40);
    const fullError = `${errorMsg} ${error.message}`;
    if (insufficientFundsErrMsg.test(fullError) || emptyAccountErrMsg.test(fullError)) {
      errorMsg = 'Insufficient funds for gas fees';
    }
    return { form: errorMsg };
  }
}
