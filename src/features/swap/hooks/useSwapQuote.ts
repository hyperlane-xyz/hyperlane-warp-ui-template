import { getBridgeFee, getSwapQuote } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { BigNumber } from 'ethers';
import { useMultiProvider } from '../../chains/hooks';
import { getSwapConfig } from '../swapConfig';

export interface SwapQuoteResult {
  /** Amount of bridge token received after origin swap */
  swapOutput: BigNumber;
  /** ETH fee for warp bridge transferRemote */
  bridgeFee: BigNumber;
  /** Token the bridge fee is denominated in */
  bridgeFeeToken: string;
}

export function useSwapQuote(
  originChainName: string | undefined,
  destinationChainName: string | undefined,
  originTokenAddress: string | undefined,
  amountWei: string | undefined,
) {
  const multiProvider = useMultiProvider();

  return useQuery({
    queryKey: [
      'swapQuote',
      originChainName,
      destinationChainName,
      originTokenAddress,
      amountWei,
    ] as const,
    queryFn: async (): Promise<SwapQuoteResult | null> => {
      if (!originChainName || !destinationChainName || !originTokenAddress || !amountWei) {
        return null;
      }

      const originConfig = getSwapConfig(originChainName);
      const destConfig = getSwapConfig(destinationChainName);
      if (!originConfig || !destConfig) return null;

      const amount = BigNumber.from(amountWei);
      if (amount.isZero()) return null;

      const provider = multiProvider.getEthersV5Provider(originChainName);

      const swapOutput = await getSwapQuote(
        provider,
        originTokenAddress,
        originConfig.bridgeToken,
        amount,
      );

      const bridge = await getBridgeFee(
        provider,
        originConfig.warpRoute,
        destConfig.domainId,
        swapOutput,
      );

      return {
        swapOutput,
        bridgeFee: bridge.fee,
        bridgeFeeToken: bridge.feeToken,
      };
    },
    enabled:
      !!originChainName &&
      !!destinationChainName &&
      !!originTokenAddress &&
      !!amountWei &&
      amountWei !== '0',
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
