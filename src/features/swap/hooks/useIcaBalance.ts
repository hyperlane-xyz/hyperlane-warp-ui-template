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
  const publicClientChainId = publicClient?.chain?.id;
  const config = chainName ? getSwapConfig(chainName) : undefined;
  const bridgeToken = config?.bridgeToken;
  const wrappedNative = config?.wrappedNative;
  const normalizedIcaAddress = icaAddress?.toLowerCase();
  const normalizedBridgeToken = bridgeToken?.toLowerCase();
  const normalizedWrappedNative = wrappedNative?.toLowerCase();

  return useQuery({
    // We intentionally avoid object references in this key to keep cache stable
    // across provider instance churn from app context re-creation.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [
      'icaBalance',
      normalizedIcaAddress,
      chainId,
      normalizedBridgeToken,
      normalizedWrappedNative,
      publicClientChainId,
    ] as const,
    queryFn: async (): Promise<{ tokens: IcaTokenBalance[] } | null> => {
      if (!normalizedIcaAddress || !normalizedBridgeToken) return null;
      const includeWrapped =
        !!normalizedWrappedNative && normalizedWrappedNative !== normalizedBridgeToken;

      if (!publicClient) {
        const fallbackTokens: IcaTokenBalance[] = [
          { symbol: 'USDC', balance: '0.00', address: normalizedBridgeToken, decimals: 6 },
        ];
        if (includeWrapped && normalizedWrappedNative) {
          fallbackTokens.push({
            symbol: 'WETH',
            balance: '0.00',
            address: normalizedWrappedNative,
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
          address: normalizedBridgeToken as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [normalizedIcaAddress as `0x${string}`],
        }),
      ];
      if (includeWrapped && normalizedWrappedNative) {
        balanceReads.push(
          publicClient.readContract({
            address: normalizedWrappedNative as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [normalizedIcaAddress as `0x${string}`],
          }),
        );
      }
      balanceReads.push(
        publicClient.getBalance({
          address: normalizedIcaAddress as `0x${string}`,
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
          address: normalizedBridgeToken,
          decimals: 6,
        },
      ];
      if (includeWrapped && normalizedWrappedNative && wrappedRaw !== undefined) {
        tokens.push({
          symbol: 'WETH',
          balance: Number(formatUnits(wrappedRaw, 18)).toFixed(4),
          address: normalizedWrappedNative,
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
    enabled: !!normalizedIcaAddress && !!normalizedBridgeToken,
    staleTime: 15_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
    refetchInterval: 30_000,
  });
}
