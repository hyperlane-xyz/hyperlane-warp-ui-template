import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseAbi } from 'viem';
import { usePublicClient } from 'wagmi';
import { getSwapConfig } from '../swapConfig';

const erc20Abi = parseAbi(['function balanceOf(address account) view returns (uint256)']);

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface IcaTokenBalance {
  symbol: string;
  balance: string;
  address: string;
  decimals: number;
  isNative?: boolean;
}

export function useIcaBalance(icaAddress: string | null, chainId: number, chainName?: string) {
  const publicClient = usePublicClient({ chainId });
  const config = chainName ? getSwapConfig(chainName) : undefined;
  const bridgeToken = config?.bridgeToken;
  const wrappedNative = config?.wrappedNative;

  return useQuery({
    queryKey: [
      'icaBalance',
      icaAddress,
      chainId,
      bridgeToken,
      wrappedNative,
      publicClient,
    ] as const,
    queryFn: async (): Promise<{ tokens: IcaTokenBalance[] } | null> => {
      if (!icaAddress || !bridgeToken) return null;
      const includeWrapped =
        !!wrappedNative && wrappedNative.toLowerCase() !== bridgeToken.toLowerCase();

      if (!publicClient) {
        const fallbackTokens: IcaTokenBalance[] = [
          { symbol: 'USDC', balance: '0.00', address: bridgeToken, decimals: 6 },
        ];
        if (includeWrapped && wrappedNative) {
          fallbackTokens.push({
            symbol: 'WETH',
            balance: '0.00',
            address: wrappedNative,
            decimals: 18,
          });
        }
        fallbackTokens.push({
          symbol: 'ETH',
          balance: '0.00',
          address: ZERO_ADDRESS,
          decimals: 18,
          isNative: true,
        });
        return { tokens: fallbackTokens };
      }

      const balanceReads: Promise<bigint>[] = [
        publicClient.readContract({
          address: bridgeToken as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [icaAddress as `0x${string}`],
        }),
      ];
      if (includeWrapped && wrappedNative) {
        balanceReads.push(
          publicClient.readContract({
            address: wrappedNative as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [icaAddress as `0x${string}`],
          }),
        );
      }
      balanceReads.push(
        publicClient.getBalance({
          address: icaAddress as `0x${string}`,
        }),
      );
      const balances = await Promise.all(balanceReads);
      const usdcRaw = balances[0];
      const wrappedRaw = includeWrapped ? balances[1] : undefined;
      const ethRaw = balances[balances.length - 1];

      const tokens: IcaTokenBalance[] = [
        {
          symbol: 'USDC',
          balance: Number(formatUnits(usdcRaw, 6)).toFixed(2),
          address: bridgeToken,
          decimals: 6,
        },
      ];
      if (includeWrapped && wrappedNative && wrappedRaw !== undefined) {
        tokens.push({
          symbol: 'WETH',
          balance: Number(formatUnits(wrappedRaw, 18)).toFixed(4),
          address: wrappedNative,
          decimals: 18,
        });
      }
      tokens.push({
        symbol: 'ETH',
        balance: Number(formatUnits(ethRaw, 18)).toFixed(4),
        address: ZERO_ADDRESS,
        decimals: 18,
        isNative: true,
      });

      return {
        tokens,
      };
    },
    enabled: !!icaAddress && !!bridgeToken,
    refetchInterval: 30_000,
  });
}
