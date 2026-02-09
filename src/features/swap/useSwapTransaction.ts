import { SwapFormValues, SwapQuote, SwapStatus } from './types';

export function useSwapTransaction() {
  return {
    status: SwapStatus.Idle,
    executeSwap: async (values: SwapFormValues, quote: SwapQuote) => {
      void values;
      void quote;
      console.log('Swap execution not yet implemented');
    },
    reset: () => {},
    error: null as string | null,
    txHash: null as string | null,
  };
}
