import { useQuery } from '@tanstack/react-query';
import { DEFAULT_SLIPPAGE } from '../swapConfig';
import { SwapQuote } from '../types';

const SWAP_QUOTE_REFRESH_INTERVAL = 15_000;

export function useSwapQuote(
  originToken: string | null,
  destinationToken: string | null,
  amount: string,
  originChainId: number,
  destinationChainId: number,
) {
  return useQuery({
    queryKey: [
      'swapQuote',
      originToken,
      destinationToken,
      amount,
      originChainId,
      destinationChainId,
    ],
    queryFn: async (): Promise<SwapQuote | null> => {
      if (!originToken || !destinationToken || !amount || parseFloat(amount) <= 0) {
        return null;
      }

      const amountNum = parseFloat(amount);
      return {
        originSwapRate: '1 ETH ~= 2,500 USDC',
        bridgeFee: '~0.001 ETH',
        destinationSwapRate: '1 USDC ~= 1 USDC',
        estimatedOutput: (amountNum * 2500 * 0.995).toFixed(2),
        minimumReceived: (amountNum * 2500 * 0.99).toFixed(2),
        slippage: DEFAULT_SLIPPAGE,
      };
    },
    enabled: !!originToken && !!destinationToken && !!amount && parseFloat(amount) > 0,
    refetchInterval: SWAP_QUOTE_REFRESH_INTERVAL,
    staleTime: 10_000,
  });
}
