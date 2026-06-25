import { ChainName } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useSolanaAccount } from '@hyperlane-xyz/widgets/walletIntegrations/solana';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { type Address, createPublicClient, http } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';

import { useMultiProvider } from '../../chains/hooks';
import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';
import { fetchEvmChainBalances } from './evm';
import { fetchSolanaChainBalances } from './solana';
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
  const connectedSolana = useSolanaAccount(multiProvider).addresses[0]?.address;

  const filtered = useMemo(() => {
    if (chainFilter === 'all') return [];
    return tokens.filter((t) => t.chainName === chainFilter);
  }, [tokens, chainFilter]);

  const filteredChainId = filtered[0]?.chainId;
  const filteredProtocol = filtered[0] ? multiProvider.tryGetProtocol(filtered[0].chainName) : null;
  const filteredPublicClient = usePublicClient({ chainId: filteredChainId });
  const filteredAddress =
    addressOverride ||
    (filteredProtocol === ProtocolType.Sealevel ? connectedSolana : connectedEvm);

  const singleChainQuery = useQuery({
    queryKey: [
      'balances',
      filteredProtocol,
      filteredChainId,
      filteredAddress,
      filtered.map(getTokenKey).join(','),
    ],
    queryFn: () =>
      dispatchChainBalances(
        filteredProtocol!,
        filtered,
        filteredAddress!,
        filteredPublicClient,
        multiProvider,
        batchAddressFor(multiProvider, filtered[0]?.chainName),
      ),
    enabled:
      chainFilter !== 'all' &&
      !!filteredAddress &&
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
      const fanoutAddress =
        addressOverride || (protocol === ProtocolType.Sealevel ? connectedSolana : connectedEvm);
      return {
        queryKey: [
          'balances',
          protocol,
          chainId,
          fanoutAddress,
          chainTokens.map(getTokenKey).join(','),
        ],
        queryFn: async (): Promise<Record<string, bigint>> => {
          if (!protocol || !fanoutAddress) return {};
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
            fanoutAddress,
            client as ReturnType<typeof usePublicClient>,
            multiProvider,
            batchAddressFor(multiProvider, chainTokens[0]?.chainName),
          );
        },
        enabled: chainFilter === 'all' && !!fanoutAddress && chainTokens.length > 0,
        staleTime: STALE_BALANCE_MS,
      };
    }),
  });

  const hasAnyAddress = !!(connectedEvm || connectedSolana || addressOverride);

  return useMemo(() => {
    if (chainFilter === 'all') {
      const merged: Record<string, bigint> = {};
      let anyLoading = false;
      for (const q of fanoutQueries) {
        if (q.isLoading) anyLoading = true;
        if (q.data) Object.assign(merged, q.data);
      }
      return { balances: merged, isLoading: anyLoading, hasAnyAddress };
    }
    return {
      balances: singleChainQuery.data ?? {},
      isLoading: singleChainQuery.isLoading,
      hasAnyAddress: !!filteredAddress,
    };
  }, [
    chainFilter,
    fanoutQueries,
    singleChainQuery.data,
    singleChainQuery.isLoading,
    filteredAddress,
    hasAnyAddress,
  ]);
}

// Single-token balance — for OriginTokenCard's balance row + MaxButton.
export function useTokenBalance(token: UiToken | undefined, addressOverride?: string) {
  const multiProvider = useMultiProvider();
  const { address: connectedEvm } = useAccount();
  const connectedSolana = useSolanaAccount(multiProvider).addresses[0]?.address;
  const protocol = token ? multiProvider.tryGetProtocol(token.chainName) : null;
  const connectedForProtocol = protocol === ProtocolType.Sealevel ? connectedSolana : connectedEvm;
  const userAddress = addressOverride || connectedForProtocol;
  const publicClient = usePublicClient({ chainId: token?.chainId });

  return useQuery({
    queryKey: ['balance', protocol, token ? getTokenKey(token) : undefined, userAddress],
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
  if (protocol === ProtocolType.Sealevel) {
    const rpcUrl = tokens[0]
      ? multiProvider.tryGetChainMetadata(tokens[0].chainName)?.rpcUrls?.[0]?.http
      : undefined;
    if (!rpcUrl) return {};
    return fetchSolanaChainBalances(tokens, rpcUrl, userAddress);
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
