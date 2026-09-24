import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk';
import { getAddressProtocolType, ProtocolType } from '@hyperlane-xyz/utils';
import { useAccounts } from '@hyperlane-xyz/widgets/walletIntegrations/accounts';
import { useAccountAddressForChain } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { type Address, createPublicClient, http, type PublicClient } from 'viem';

import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import type { BalanceToken } from './types';
import { getBalanceTokenKey } from './types';

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
  tokens: BalanceToken[],
  chainFilter: ChainName | 'all',
  addressOverride?: string,
): UseTokenBalancesResult {
  const multiProvider = useMultiProvider();
  const chainAddresses = useStore((s) => s.chainAddresses);
  const { accounts, readyAccounts } = useAccounts(multiProvider);
  const overrideProtocol = useMemo(
    () => (addressOverride ? getAddressProtocolType(addressOverride) : undefined),
    [addressOverride],
  );

  const filtered = useMemo(() => {
    if (chainFilter === 'all') return [];
    return tokens.filter((t) => t.chainName === chainFilter);
  }, [tokens, chainFilter]);

  const filteredChainId = filtered[0]?.chainId;
  const filteredChainName = filtered[0]?.chainName;
  const filteredProtocol = filtered[0] ? multiProvider.tryGetProtocol(filtered[0].chainName) : null;
  const filteredUserAddress = addressForProtocol(
    accounts,
    filteredProtocol,
    filteredChainName,
    addressOverride,
    overrideProtocol,
  );
  const filteredRpcUrl = rpcUrlFor(multiProvider, filteredChainName);
  const filteredPublicClient = useMemo(
    () =>
      filteredProtocol === ProtocolType.Ethereum ? evmClientFromRpc(filteredRpcUrl) : undefined,
    [filteredProtocol, filteredRpcUrl],
  );

  const singleChainQuery = useQuery({
    queryKey: [
      'balances',
      filteredProtocol,
      filteredChainId,
      filteredRpcUrl,
      batchAddressFor(chainAddresses, filtered[0]?.chainName),
      filteredUserAddress,
      filtered.map(getBalanceTokenKey).join(','),
    ],
    queryFn: () =>
      dispatchChainBalances(
        filteredProtocol!,
        filtered,
        filteredUserAddress!,
        filteredPublicClient,
        multiProvider,
        batchAddressFor(chainAddresses, filtered[0]?.chainName),
      ),
    enabled:
      chainFilter !== 'all' &&
      !!filteredUserAddress &&
      filtered.length > 0 &&
      (filteredProtocol !== ProtocolType.Ethereum || !!filteredPublicClient),
    staleTime: STALE_BALANCE_MS,
    refetchInterval: STALE_BALANCE_MS,
  });

  const tokensByChain = useMemo(() => {
    if (chainFilter !== 'all') return new Map<number, BalanceToken[]>();
    const map = new Map<number, BalanceToken[]>();
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
      const chainName = chainTokens[0]?.chainName;
      const userAddress = addressForProtocol(
        accounts,
        protocol,
        chainName,
        addressOverride,
        overrideProtocol,
      );
      return {
        queryKey: [
          'balances',
          protocol,
          chainId,
          rpcUrlFor(multiProvider, chainName),
          batchAddressFor(chainAddresses, chainName),
          userAddress,
          chainTokens.map(getBalanceTokenKey).join(','),
        ],
        queryFn: async (): Promise<Record<string, bigint>> => {
          if (!protocol || !userAddress) return {};
          const client =
            protocol === ProtocolType.Ethereum
              ? evmClientFromRpc(rpcUrlFor(multiProvider, chainName))
              : undefined;
          return dispatchChainBalances(
            protocol,
            chainTokens,
            userAddress,
            client,
            multiProvider,
            batchAddressFor(chainAddresses, chainTokens[0]?.chainName),
          );
        },
        enabled: chainFilter === 'all' && !!userAddress && chainTokens.length > 0,
        staleTime: STALE_BALANCE_MS,
        refetchInterval: STALE_BALANCE_MS,
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
      return {
        balances: merged,
        isLoading: anyLoading,
        hasAnyAddress: !!addressOverride || readyAccounts.length > 0,
      };
    }
    return {
      balances: singleChainQuery.data ?? {},
      isLoading: singleChainQuery.isLoading,
      hasAnyAddress: !!filteredUserAddress,
    };
  }, [
    chainFilter,
    addressOverride,
    fanoutQueries,
    filteredUserAddress,
    readyAccounts.length,
    singleChainQuery.data,
    singleChainQuery.isLoading,
  ]);
}

// Single-token balance — for OriginTokenCard's balance row + MaxButton.
export function useTokenBalance(token: BalanceToken | undefined, addressOverride?: string) {
  const multiProvider = useMultiProvider();
  const chainAddresses = useStore((s) => s.chainAddresses);
  const protocol = token ? multiProvider.tryGetProtocol(token.chainName) : null;
  const connectedAddress = useAccountAddressForChain(multiProvider, token?.chainName);
  const overrideProtocol = useMemo(
    () => (addressOverride ? getAddressProtocolType(addressOverride) : undefined),
    [addressOverride],
  );
  const userAddress =
    addressOverride && protocol && (!overrideProtocol || protocolsMatch(overrideProtocol, protocol))
      ? addressOverride
      : connectedAddress;
  const rpcUrl = rpcUrlFor(multiProvider, token?.chainName);
  const publicClient = useMemo(
    () => (protocol === ProtocolType.Ethereum ? evmClientFromRpc(rpcUrl) : undefined),
    [protocol, rpcUrl],
  );

  return useQuery({
    queryKey: [
      'balance',
      protocol,
      token ? getBalanceTokenKey(token) : null,
      rpcUrl,
      token ? batchAddressFor(chainAddresses, token.chainName) : undefined,
      userAddress,
    ],
    queryFn: async () => {
      if (!token || !userAddress || !protocol) return null;
      const balances = await dispatchChainBalances(
        protocol,
        [token],
        userAddress,
        publicClient,
        multiProvider,
        batchAddressFor(chainAddresses, token.chainName),
      );
      return balances[getBalanceTokenKey(token)] ?? null;
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
  tokens: BalanceToken[],
  userAddress: string,
  publicClient: PublicClient | undefined,
  multiProvider: ReturnType<typeof useMultiProvider>,
  multicallAddress?: Address,
): Promise<Record<string, bigint>> {
  if (protocol === ProtocolType.Ethereum) {
    if (!publicClient) return {};
    const { fetchEvmChainBalances } = await import('./evm');
    return fetchEvmChainBalances(publicClient, tokens, userAddress as Address, multicallAddress);
  }
  if (protocol === ProtocolType.Tron) {
    const { fetchTronChainBalances } = await import('./tron');
    return fetchTronChainBalances(multiProvider, tokens, userAddress);
  }
  if (protocol === ProtocolType.Sealevel) {
    const rpcUrl = rpcUrlFor(multiProvider, tokens[0]?.chainName);
    if (!rpcUrl) return {};
    const { fetchSealevelChainBalances } = await import('./sealevel');
    return fetchSealevelChainBalances(rpcUrl, tokens, userAddress);
  }
  if (protocol === ProtocolType.Starknet) {
    const { fetchStarknetChainBalances } = await import('./starknet');
    return fetchStarknetChainBalances(multiProvider, tokens, userAddress);
  }
  if (protocol === ProtocolType.Cosmos || protocol === ProtocolType.CosmosNative) {
    const { fetchCosmosChainBalances } = await import('./cosmos');
    return fetchCosmosChainBalances(multiProvider, tokens, userAddress);
  }
  if (protocol === ProtocolType.Radix) {
    const { fetchRadixChainBalances } = await import('./radix');
    return fetchRadixChainBalances(multiProvider, tokens, userAddress);
  }
  if (protocol === ProtocolType.Aleo) {
    const { fetchAleoChainBalances } = await import('./aleo');
    return fetchAleoChainBalances(multiProvider, tokens, userAddress);
  }
  return {};
}

type AccountsByProtocol = ReturnType<typeof useAccounts>['accounts'];

function addressForProtocol(
  accounts: AccountsByProtocol,
  protocol: ProtocolType | null,
  chainName: string | undefined,
  addressOverride: string | undefined,
  overrideProtocol: ProtocolType | undefined,
): string | undefined {
  if (!protocol) return undefined;
  if (addressOverride && (!overrideProtocol || protocolsMatch(overrideProtocol, protocol)))
    return addressOverride;
  const account = accounts[protocol];
  if (protocol === ProtocolType.Cosmos || protocol === ProtocolType.CosmosNative) {
    return account?.addresses.find((a) => a.chainName === chainName)?.address;
  }
  return account?.addresses[0]?.address;
}

function protocolsMatch(left: ProtocolType, right: ProtocolType): boolean {
  if (left === right) return true;
  return isCosmosProtocol(left) && isCosmosProtocol(right);
}

function isCosmosProtocol(protocol: ProtocolType): boolean {
  return protocol === ProtocolType.Cosmos || protocol === ProtocolType.CosmosNative;
}

function rpcUrlFor(
  multiProvider: ReturnType<typeof useMultiProvider>,
  chainName: string | undefined,
): string | undefined {
  if (!chainName) return undefined;
  return multiProvider.tryGetChainMetadata(chainName)?.rpcUrls?.[0]?.http;
}

function evmClientFromRpc(rpcUrl: string | undefined): PublicClient | undefined {
  return rpcUrl
    ? (createPublicClient({ transport: http(rpcUrl) }) as unknown as PublicClient)
    : undefined;
}

function batchAddressFor(
  chainAddresses: ChainMap<ChainAddresses>,
  chainName: string | undefined,
): Address | undefined {
  if (!chainName) return undefined;
  return chainAddresses[chainName]?.batchContractAddress as Address | undefined;
}
