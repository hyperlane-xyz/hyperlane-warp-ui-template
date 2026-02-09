import { ProtocolType } from '@hyperlane-xyz/utils';
import { useAccountForChain, useConnectFns } from '@hyperlane-xyz/widgets';
import { Form, Formik, FormikHelpers, useFormikContext } from 'formik';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { SolidButton } from '../../components/buttons/SolidButton';
import { useChainProtocol, useMultiProvider } from '../chains/hooks';
import { useEvmWalletBalance } from '../tokens/balances';
import { TransferSection } from '../transfer/TransferSection';
import { SwapDirectionIndicator } from './components/SwapDirectionIndicator';
import { SwapQuoteDisplay } from './components/SwapQuoteDisplay';
import { SwapTokenCard } from './components/SwapTokenCard';
import { SWAP_CHAINS, SWAP_CONTRACTS } from './swapConfig';
import { useSwapQuote } from './hooks/useSwapQuote';
import { useSwapTokens } from './hooks/useSwapTokens';
import { useSwapTransaction } from './useSwapTransaction';
import { SwapFormValues, SwapQuote, SwapStatus } from './types';

const ARBITRUM_CHAIN_NAME = 'arbitrum';
const BASE_CHAIN_NAME = 'base';

export function SwapTokenForm() {
  const multiProvider = useMultiProvider();
  const protocol = useChainProtocol(ARBITRUM_CHAIN_NAME) || ProtocolType.Ethereum;
  const connectFns = useConnectFns();
  const account = useAccountForChain(multiProvider, ARBITRUM_CHAIN_NAME);
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const isWalletReady = account?.isReady ?? false;

  const { status, error, txHash, executeSwap, reset } = useSwapTransaction();
  const [isReview, setIsReview] = useState(false);
  const [activeQuote, setActiveQuote] = useState<SwapQuote | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialValues: SwapFormValues = {
    originChainId: SWAP_CHAINS.origin.chainId,
    destinationChainId: SWAP_CHAINS.destination.chainId,
    originTokenAddress: SWAP_CONTRACTS.usdcArb,
    destinationTokenAddress: SWAP_CONTRACTS.usdcBase,
    amount: '',
  };

  const onSubmit = useCallback(
    async (values: SwapFormValues, helpers: FormikHelpers<SwapFormValues>) => {
      if (!isReview) {
        if (!activeQuote) {
          setSubmitError('Quote unavailable. Please provide an amount and wait for quote refresh.');
          helpers.setSubmitting(false);
          return;
        }
        setSubmitError(null);
        setIsReview(true);
        helpers.setSubmitting(false);
        return;
      }

      if (!activeQuote) {
        setSubmitError('Quote expired. Please edit and review again.');
        helpers.setSubmitting(false);
        return;
      }

      if (!isWalletReady) {
        connectFns[protocol]();
        helpers.setSubmitting(false);
        return;
      }

      try {
        setSubmitError(null);
        if (!walletClient || !publicClient) {
          throw new Error('Wallet client unavailable. Reconnect wallet and retry.');
        }
        await executeSwap(values, activeQuote, walletClient, publicClient);
      } catch (err: unknown) {
        const txError = err as { message?: string };
        setSubmitError(txError.message || 'Unable to access wallet signer.');
      } finally {
        helpers.setSubmitting(false);
      }
    },
    [activeQuote, connectFns, executeSwap, isReview, isWalletReady, protocol, publicClient, walletClient],
  );

  const onEdit = () => {
    setIsReview(false);
    setSubmitError(null);
    reset();
  };

  return (
    <Formik<SwapFormValues> initialValues={initialValues} onSubmit={onSubmit}>
      <Form className="flex w-full flex-col items-stretch gap-1.5">
        <SwapFormFields
          isReview={isReview}
          onQuoteChange={(quote) => {
            setActiveQuote(quote);
            if (!quote && isReview) setIsReview(false);
          }}
        />

        {isReview && activeQuote && <SwapReviewSummary quote={activeQuote} />}

        {!isReview ? (
          <ConnectAwareSubmitButton<SwapFormValues>
            chainName={ARBITRUM_CHAIN_NAME}
            text="Review Swap"
            classes="mb-4 w-full px-3 py-2.5 font-secondary text-xl text-cream-100"
            disabled={
              !activeQuote ||
              (status !== SwapStatus.Idle &&
                status !== SwapStatus.Failed &&
                status !== SwapStatus.ReviewMode)
            }
          />
        ) : (
          <div className="mb-4 mt-4 flex items-center justify-between space-x-4">
            <SolidButton
              type="button"
              color="primary"
              onClick={onEdit}
              className="px-6 py-1.5 font-secondary"
            >
              Edit
            </SolidButton>
            <SolidButton
              type="submit"
              color="accent"
              disabled={status !== SwapStatus.Idle && status !== SwapStatus.Failed}
              className="flex-1 px-3 py-1.5 font-secondary text-white"
            >
              {isWalletReady ? 'Confirm Swap' : 'Connect Wallet'}
            </SolidButton>
          </div>
        )}

        <SwapExecutionStatus status={status} error={error || submitError} txHash={txHash} />
      </Form>
    </Formik>
  );
}

function SwapFormFields({
  isReview,
  onQuoteChange,
}: {
  isReview: boolean;
  onQuoteChange: (quote: SwapQuote | null) => void;
}) {
  const { values, setFieldValue } = useFormikContext<SwapFormValues>();

  const {
    tokens: originTokens,
    selectedToken: selectedOriginToken,
    setSelectedToken: setSelectedOriginToken,
  } = useSwapTokens(SWAP_CHAINS.origin.chainId, values.originTokenAddress);

  const {
    tokens: destinationTokens,
    selectedToken: selectedDestinationToken,
    setSelectedToken: setSelectedDestinationToken,
  } = useSwapTokens(SWAP_CHAINS.destination.chainId, values.destinationTokenAddress);

  useEffect(() => {
    if (selectedOriginToken?.address !== values.originTokenAddress) {
      setFieldValue('originTokenAddress', selectedOriginToken?.address || '');
    }
  }, [selectedOriginToken, setFieldValue, values.originTokenAddress]);

  useEffect(() => {
    if (selectedDestinationToken?.address !== values.destinationTokenAddress) {
      setFieldValue('destinationTokenAddress', selectedDestinationToken?.address || '');
    }
  }, [selectedDestinationToken, setFieldValue, values.destinationTokenAddress]);

  const { data: quote, isLoading, error } = useSwapQuote(
    selectedOriginToken?.address || null,
    selectedDestinationToken?.address || null,
    values.amount,
    SWAP_CHAINS.origin.chainId,
    SWAP_CHAINS.destination.chainId,
  );

  useEffect(() => {
    onQuoteChange(quote || null);
  }, [onQuoteChange, quote]);

  const { balance: originBalance } = useEvmWalletBalance(
    ARBITRUM_CHAIN_NAME,
    SWAP_CHAINS.origin.chainId,
    selectedOriginToken?.address || '',
    true,
  );

  const { balance: destinationBalance } = useEvmWalletBalance(
    BASE_CHAIN_NAME,
    SWAP_CHAINS.destination.chainId,
    selectedDestinationToken?.address || '',
    true,
  );

  const quoteError = error instanceof Error ? error.message : null;

  const originBalanceLabel = useMemo(() => {
    if (!originBalance) return undefined;
    return Number(originBalance.formatted).toFixed(2);
  }, [originBalance]);

  const destinationBalanceLabel = useMemo(() => {
    if (!destinationBalance) return undefined;
    return Number(destinationBalance.formatted).toFixed(2);
  }, [destinationBalance]);

  return (
    <>
      <TransferSection label="From">
        <SwapTokenCard
          side="origin"
          tokens={originTokens}
          selectedToken={selectedOriginToken}
          amount={values.amount}
          disabled={isReview}
          onTokenSelect={(token) => {
            setSelectedOriginToken(token);
            setFieldValue('originTokenAddress', token.address);
          }}
          onAmountChange={(amount) => setFieldValue('amount', amount)}
          balance={originBalanceLabel}
        />
      </TransferSection>

      <SwapDirectionIndicator />

      <TransferSection label="To">
        <SwapTokenCard
          side="destination"
          tokens={destinationTokens}
          selectedToken={selectedDestinationToken}
          amount={values.amount}
          disabled={isReview}
          onTokenSelect={(token) => {
            setSelectedDestinationToken(token);
            setFieldValue('destinationTokenAddress', token.address);
          }}
          balance={destinationBalanceLabel}
          estimatedOutput={quote?.estimatedOutput}
        />
      </TransferSection>

      <SwapQuoteDisplay quote={quote || null} isLoading={isLoading} error={quoteError} />
    </>
  );
}

function SwapReviewSummary({ quote }: { quote: SwapQuote }) {
  return (
    <div className="mt-3 rounded border border-gray-400/25 bg-gray-150 px-3 py-2 text-sm text-gray-800">
      <div className="mb-1 font-secondary text-base text-gray-900">Review swap</div>
      <div>Origin swap: {quote.originSwapRate}</div>
      <div>Bridge fee: {quote.bridgeFee}</div>
      <div>Destination swap: {quote.destinationSwapRate}</div>
      <div>Estimated output: {quote.estimatedOutput}</div>
      <div>Minimum received: {quote.minimumReceived}</div>
    </div>
  );
}

function SwapExecutionStatus({
  status,
  error,
  txHash,
}: {
  status: SwapStatus;
  error: string | null;
  txHash: string | null;
}) {
  const statusMessage = getStatusMessage(status);
  if (!statusMessage && !error && !txHash) return null;

  return (
    <div className="mb-4 rounded border border-gray-400/25 bg-gray-150 px-3 py-2 text-sm text-gray-800">
      {statusMessage && <div>Status: {statusMessage}</div>}
      {txHash && <div className="break-all">Tx hash: {txHash}</div>}
      {error && <div className="text-red-700">{error}</div>}
    </div>
  );
}

function getStatusMessage(status: SwapStatus): string | null {
  if (status === SwapStatus.Idle || status === SwapStatus.ReviewMode) return null;
  if (status === SwapStatus.PostingCommitment) return 'Posting commitment...';
  if (status === SwapStatus.Approving) return 'Waiting for token approval...';
  if (status === SwapStatus.Signing) return 'Sign transaction in wallet...';
  if (status === SwapStatus.Confirming) return 'Confirming transaction...';
  if (status === SwapStatus.Bridging) return 'Bridge in progress...';
  if (status === SwapStatus.Executing) return 'Executing destination swap...';
  if (status === SwapStatus.Complete) return 'Swap complete.';
  if (status === SwapStatus.Failed) return 'Swap failed.';
  return null;
}
