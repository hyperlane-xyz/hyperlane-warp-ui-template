import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseAbi } from 'viem';
import { usePublicClient } from 'wagmi';
import { getSwapConfig } from '../swapConfig';

const erc20Abi = parseAbi(['function balanceOf(address account) view returns (uint256)']);

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface IcaTokenBalance {
  symbol: 'USDC' | 'ETH';
  balance: string;
  address: string;
}

export function useIcaBalance(icaAddress: string | null, chainId: number, chainName?: string) {
  const publicClient = usePublicClient({ chainId });
  const bridgeToken = chainName ? getSwapConfig(chainName)?.bridgeToken : undefined;

  return useQuery({
    queryKey: ['icaBalance', icaAddress, chainId, bridgeToken, publicClient] as const,
    queryFn: async (): Promise<{ tokens: IcaTokenBalance[] } | null> => {
      if (!icaAddress || !bridgeToken) return null;

      if (!publicClient) {
        return {
          tokens: [
            { symbol: 'USDC', balance: '0.00', address: bridgeToken },
            { symbol: 'ETH', balance: '0.00', address: ZERO_ADDRESS },
          ],
        };
      }

      const [usdcRaw, ethRaw] = await Promise.all([
        publicClient.readContract({
          address: bridgeToken as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [icaAddress as `0x${string}`],
        }),
        publicClient.getBalance({
          address: icaAddress as `0x${string}`,
        }),
      ]);

      return {
        tokens: [
          {
            symbol: 'USDC',
            balance: Number(formatUnits(usdcRaw, 6)).toFixed(2),
            address: bridgeToken,
          },
          {
            symbol: 'ETH',
            balance: Number(formatUnits(ethRaw, 18)).toFixed(4),
            address: ZERO_ADDRESS,
          },
        ],
      };
    },
    enabled: !!icaAddress && !!bridgeToken,
    refetchInterval: 30_000,
  });
}
