import { ChainName } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { type Address, createPublicClient, http } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';

import { useMultiProvider } from '../../../chains/hooks';
import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';
import { fetchEvmChainBalances } from './evm';
import { fetchTronChainBalances } from './tron';

const STALE_BALANCE_MS = 30_000;

interface UseTokenBalancesResult {
  balances: Record<string, bigint>;
  isLoading: boolean;
  hasAnyAddress: boolean;
}

// Multi-token batch balance reader.
//   chainFilter = '<chainName>' → one query: multicall for that chain.
//   chainFilter = 'all'          → fan-out via useQueries, one per unique chain.
export function useTokenBalances(
  tokens: UiToken[],
  chainFilter: ChainName | 'all',
  addressOverride?: string,
): UseTokenBalancesResult {
  const multiProvider = useMultiProvider();
  const { address: connectedEvm } = useAccount();
  const userAddress = addressOverride || connectedEvm;

  const filtered = useMemo(() => {
    if (chainFilter === 'all') return [];
    return tokens.filter((t) => t.chainName === chainFilter);
  }, [tokens, chainFilter]);

  const filteredChainId = filtered[0]?.chainId;
  const filteredProtocol = filtered[0] ? multiProvider.tryGetProtocol(filtered[0].chainName) : null;
  const filteredPublicClient = usePublicClient({ chainId: filteredChainId });

  const singleChainQuery = useQuery({
    queryKey: [
      'balances',
      filteredProtocol,
      filteredChainId,
      userAddress,
      filtered.map((t) => t.address.toLowerCase()).join(','),
    ],
    queryFn: () =>
      dispatchChainBalances(
        filteredProtocol!,
        filtered,
        userAddress!,
        filteredPublicClient,
        multiProvider,
        batchAddressFor(multiProvider, filtered[0]?.chainName),
      ),
    enabled:
      chainFilter !== 'all' &&
      !!userAddress &&
      filtered.length > 0 &&
      (filteredProtocol !== ProtocolType.Ethereum || !!filteredPublicClient),
    staleTime: STALE_BALANCE_MS,
  });

  const tokensByChain = useMemo(() => {
    if (chainFilter !== 'all') return new Map<number, UiToken[]>();
    const map = new Map<number, UiToken[]>();
    for (const t of tokens) {
      const list = map.get(t.chainId) ?? [];
      list.push(t);
      map.set(t.chainId, list);
    }
    return map;
  }, [tokens, chainFilter]);

  const fanoutEntries = useMemo(() => Array.from(tokensByChain.entries()), [tokensByChain]);

  const fanoutQueries = useQueries({
    queries: fanoutEntries.map(([chainId, chainTokens]) => {
      const protocol = chainTokens[0]
        ? multiProvider.tryGetProtocol(chainTokens[0].chainName)
        : null;
      return {
        queryKey: [
          'balances',
          protocol,
          chainId,
          userAddress,
          chainTokens.map((t) => t.address.toLowerCase()).join(','),
        ],
        queryFn: async (): Promise<Record<string, bigint>> => {
          if (!protocol || !userAddress) return {};
          const rpcUrl = chainTokens[0]
            ? multiProvider.tryGetChainMetadata(chainTokens[0].chainName)?.rpcUrls?.[0]?.http
            : undefined;
          const client =
            protocol === ProtocolType.Ethereum && rpcUrl
              ? createPublicClient({ transport: http(rpcUrl) })
              : null;
          return dispatchChainBalances(
            protocol,
            chainTokens,
            userAddress,
            client as ReturnType<typeof usePublicClient>,
            multiProvider,
            batchAddressFor(multiProvider, chainTokens[0]?.chainName),
          );
        },
        enabled: chainFilter === 'all' && !!userAddress && chainTokens.length > 0,
        staleTime: STALE_BALANCE_MS,
      };
    }),
  });

  return useMemo(() => {
    if (chainFilter === 'all') {
      const merged: Record<string, bigint> = {};
      let anyLoading = false;
      for (const q of fanoutQueries) {
        if (q.isLoading) anyLoading = true;
        if (q.data) Object.assign(merged, q.data);
      }
      return { balances: merged, isLoading: anyLoading, hasAnyAddress: !!userAddress };
    }
    return {
      balances: singleChainQuery.data ?? {},
      isLoading: singleChainQuery.isLoading,
      hasAnyAddress: !!userAddress,
    };
  }, [chainFilter, fanoutQueries, singleChainQuery.data, singleChainQuery.isLoading, userAddress]);
}

// Single-token balance — for OriginTokenCard's balance row + MaxButton.
export function useTokenBalance(token: UiToken | undefined, addressOverride?: string) {
  const multiProvider = useMultiProvider();
  const { address: connectedEvm } = useAccount();
  const userAddress = addressOverride || connectedEvm;
  const publicClient = usePublicClient({ chainId: token?.chainId });
  const protocol = token ? multiProvider.tryGetProtocol(token.chainName) : null;

  return useQuery({
    queryKey: ['balance', protocol, token?.chainId, token?.address.toLowerCase(), userAddress],
    queryFn: async () => {
      if (!token || !userAddress || !protocol) return null;
      const balances = await dispatchChainBalances(
        protocol,
        [token],
        userAddress,
        publicClient,
        multiProvider,
        batchAddressFor(multiProvider, token.chainName),
      );
      return balances[getTokenKey(token)] ?? 0n;
    },
    enabled:
      !!token &&
      !!userAddress &&
      !!protocol &&
      (protocol !== ProtocolType.Ethereum || !!publicClient),
    staleTime: STALE_BALANCE_MS,
    refetchInterval: STALE_BALANCE_MS,
  });
}

async function dispatchChainBalances(
  protocol: ProtocolType,
  tokens: UiToken[],
  userAddress: string,
  publicClient: ReturnType<typeof usePublicClient>,
  multiProvider: ReturnType<typeof useMultiProvider>,
  multicallAddress?: Address,
): Promise<Record<string, bigint>> {
  if (protocol === ProtocolType.Ethereum) {
    if (!publicClient) return {};
    return fetchEvmChainBalances(publicClient, tokens, userAddress as Address, multicallAddress);
  }
  if (protocol === ProtocolType.Tron) {
    return fetchTronChainBalances(multiProvider, tokens, userAddress);
  }
  return {};
}

function batchAddressFor(
  multiProvider: ReturnType<typeof useMultiProvider>,
  chainName: string | undefined,
): Address | undefined {
  if (!chainName) return undefined;
  const meta = multiProvider.tryGetChainMetadata(chainName) as
    | { batchContractAddress?: string }
    | undefined;
  return meta?.batchContractAddress as Address | undefined;
}
