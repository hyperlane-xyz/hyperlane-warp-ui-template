import { Form, Formik, useFormikContext } from 'formik';
import { useEffect, useMemo } from 'react';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { useEvmWalletBalance } from '../tokens/balances';
import { TransferSection } from '../transfer/TransferSection';
import { SwapDirectionIndicator } from './components/SwapDirectionIndicator';
import { SwapQuoteDisplay } from './components/SwapQuoteDisplay';
import { SwapTokenCard } from './components/SwapTokenCard';
import { SWAP_CHAINS, SWAP_CONTRACTS } from './swapConfig';
import { useSwapQuote } from './hooks/useSwapQuote';
import { useSwapTokens } from './hooks/useSwapTokens';
import { useSwapTransaction } from './useSwapTransaction';
import { SwapFormValues, SwapStatus } from './types';

const ARBITRUM_CHAIN_NAME = 'arbitrum';
const BASE_CHAIN_NAME = 'base';

export function SwapTokenForm() {
  const { status } = useSwapTransaction();

  const initialValues: SwapFormValues = {
    originChainId: SWAP_CHAINS.origin.chainId,
    destinationChainId: SWAP_CHAINS.destination.chainId,
    originTokenAddress: SWAP_CONTRACTS.usdcArb,
    destinationTokenAddress: SWAP_CONTRACTS.usdcBase,
    amount: '',
  };

  return (
    <Formik<SwapFormValues> initialValues={initialValues} onSubmit={() => {}}>
      <Form className="flex w-full flex-col items-stretch gap-1.5">
        <SwapFormFields />

        <ConnectAwareSubmitButton<SwapFormValues>
          chainName={ARBITRUM_CHAIN_NAME}
          text="Review Swap"
          classes="mb-4 w-full px-3 py-2.5 font-secondary text-xl text-cream-100"
          disabled={status !== SwapStatus.Idle && status !== SwapStatus.ReviewMode}
        />
      </Form>
    </Formik>
  );
}

function SwapFormFields() {
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
