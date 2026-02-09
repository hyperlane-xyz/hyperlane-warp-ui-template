import { ProtocolType } from '@hyperlane-xyz/utils';
import { useAccountForChain, useConnectFns } from '@hyperlane-xyz/widgets';
import { Form, Formik, useFormikContext } from 'formik';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { useChainProtocol, useMultiProvider } from '../chains/hooks';
import { useEvmWalletBalance } from '../tokens/balances';
import { TransferSection } from '../transfer/TransferSection';
import { SwapDirectionIndicator } from './components/SwapDirectionIndicator';
import { SwapQuoteDisplay } from './components/SwapQuoteDisplay';
import { SwapReviewModal } from './components/SwapReviewModal';
import { SwapStatusDisplay } from './components/SwapStatusDisplay';
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
  const isStatusActive = status !== SwapStatus.Idle;

  const initialValues: SwapFormValues = {
    originChainId: SWAP_CHAINS.origin.chainId,
    destinationChainId: SWAP_CHAINS.destination.chainId,
    originTokenAddress: SWAP_CONTRACTS.usdcArb,
    destinationTokenAddress: SWAP_CONTRACTS.usdcBase,
    amount: '',
  };

  const onSubmit = useCallback(async () => {
    if (!activeQuote) {
      setSubmitError('Quote unavailable. Please provide an amount and wait for quote refresh.');
      return;
    }
    setSubmitError(null);
    setIsReview(true);
  }, [activeQuote]);

  const onEdit = () => {
    setIsReview(false);
    setSubmitError(null);
  };

  const onConfirm = useCallback(
    async (values: SwapFormValues) => {
      if (!activeQuote) {
        setSubmitError('Quote expired. Please edit and review again.');
        return;
      }

      if (!isWalletReady) {
        connectFns[protocol]();
        return;
      }

      if (!walletClient || !publicClient) {
        setSubmitError('Wallet client unavailable. Reconnect wallet and retry.');
        return;
      }

      setSubmitError(null);
      await executeSwap(values, activeQuote, walletClient, publicClient);
    },
    [activeQuote, connectFns, executeSwap, isWalletReady, protocol, publicClient, walletClient],
  );

  return (
    <Formik<SwapFormValues> initialValues={initialValues} onSubmit={onSubmit}>
      {({ values, isSubmitting, resetForm }) => (
        <Form className="flex w-full flex-col items-stretch gap-1.5">
          {isStatusActive ? (
            <SwapStatusDisplay
              status={status}
              txHash={txHash}
              error={error || submitError}
              onReset={() => {
                reset();
                setIsReview(false);
                setActiveQuote(null);
                setSubmitError(null);
                resetForm();
              }}
            />
          ) : (
            <>
              <SwapFormFields
                isReview={isReview}
                onQuoteChange={(quote) => {
                  setActiveQuote(quote);
                  if (!quote && isReview) setIsReview(false);
                }}
              />

              {!isReview ? (
                <ConnectAwareSubmitButton<SwapFormValues>
                  chainName={ARBITRUM_CHAIN_NAME}
                  text="Review Swap"
                  classes="mb-4 w-full px-3 py-2.5 font-secondary text-xl text-cream-100"
                  disabled={!activeQuote}
                />
              ) : (
                <SwapReviewModal
                  originToken={{
                    symbol: getTokenSymbol(values.originTokenAddress),
                    amount: values.amount,
                  }}
                  destinationToken={{
                    symbol: getTokenSymbol(values.destinationTokenAddress),
                    estimatedOutput: activeQuote?.estimatedOutput || '',
                  }}
                  quote={activeQuote}
                  onConfirm={() => void onConfirm(values)}
                  onCancel={onEdit}
                  isLoading={isSubmitting || status !== SwapStatus.Idle}
                />
              )}

              {submitError && (
                <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {submitError}
                </div>
              )}
            </>
          )}
        </Form>
      )}
    </Formik>
  );
}

function getTokenSymbol(address: string): string {
  const lower = address.toLowerCase();
  if (lower === SWAP_CONTRACTS.usdcArb.toLowerCase()) return 'USDC';
  if (lower === SWAP_CONTRACTS.usdcBase.toLowerCase()) return 'USDC';
  if (lower === SWAP_CONTRACTS.wethArb.toLowerCase()) return 'WETH';
  if (lower === SWAP_CONTRACTS.wethBase.toLowerCase()) return 'WETH';
  if (lower === '0x0000000000000000000000000000000000000000') return 'ETH';
  return 'Token';
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
