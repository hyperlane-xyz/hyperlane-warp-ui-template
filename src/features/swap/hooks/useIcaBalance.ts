import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseAbi } from 'viem';
import { usePublicClient } from 'wagmi';
import { SWAP_CONTRACTS } from '../swapConfig';

const erc20Abi = parseAbi(['function balanceOf(address account) view returns (uint256)']);

export interface IcaTokenBalance {
  symbol: 'USDC' | 'ETH';
  balance: string;
  address: string;
}

export function useIcaBalance(icaAddress: string | null, chainId: number) {
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: ['icaBalance', icaAddress, chainId],
    queryFn: async (): Promise<{ tokens: IcaTokenBalance[] } | null> => {
      if (!icaAddress) return null;

      if (!publicClient) {
        return {
          tokens: [
            { symbol: 'USDC', balance: '0.00', address: SWAP_CONTRACTS.usdcBase },
            { symbol: 'ETH', balance: '0.00', address: '0x0000000000000000000000000000000000000000' },
          ],
        };
      }

      const [usdcRaw, ethRaw] = await Promise.all([
        publicClient.readContract({
          address: SWAP_CONTRACTS.usdcBase as `0x${string}`,
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
            address: SWAP_CONTRACTS.usdcBase,
          },
          {
            symbol: 'ETH',
            balance: Number(formatUnits(ethRaw, 18)).toFixed(4),
            address: '0x0000000000000000000000000000000000000000',
          },
        ],
      };
    },
    enabled: !!icaAddress,
    refetchInterval: 30_000,
  });
}
