import { ChainName } from '@hyperlane-xyz/sdk';
import { useDebounce } from '@hyperlane-xyz/widgets';
import React, { useLayoutEffect, useMemo, useRef } from 'react';

import { TokenChainIcon } from '../../components/icons/TokenChainIcon';
import { useTokenBalances } from '../balances/hooks';
import { formatBalance, formatUsd, getUsdValue } from '../balances/utils';
import { useDisabledChains, useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useTokens } from './hooks';
import type { TokenSelectionMode, UiToken } from './types';
import { useTokenPrices } from './useTokenPrice';
import { useVirtualizedList } from './useVirtualizedList';
import {
  getTokenKey,
  getTokenRouteKind,
  mergeRouteTokensFirst,
  type TokenRouteKind,
} from './utils';

const TOKEN_ROW_SIZE = 68;
const TOKEN_LIST_PADDING = 48;
const TOKEN_LIST_TOP_PADDING = 8;

interface TokenListProps {
  selectionMode: TokenSelectionMode;
  searchQuery: string;
  chainFilter: ChainName | null;
  onSelect: (token: UiToken) => void;
  counterpartToken?: UiToken;
  /** Recipient address for destination balance lookups */
  recipient?: string;
  availableRouteTokens: UiToken[];
  hasAvailableRoutesResult: boolean;
}

export function TokenList({
  selectionMode,
  searchQuery,
  chainFilter,
  onSelect,
  counterpartToken,
  recipient,
  availableRouteTokens,
  hasAvailableRoutesResult,
}: TokenListProps) {
  const disabledChains = useDisabledChains();
  const debouncedSearch = useDebounce(searchQuery, 300);
  const trimmedSearch = debouncedSearch?.trim() || undefined;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Chain names avoid cross-VM numeric selector collisions, e.g. Ethereum
  // and Radix can both be addressed by numeric chain id 1.
  const chainSelector = chainFilter ?? undefined;

  // Server-side filtering — engine handles chain/search; the picker stops
  // doing local matchesSearch + chainFilter predicates.
  const { data: fetched, isLoading: isTokenLoading } = useTokens({
    chain: chainSelector,
    search: trimmedSearch,
  });
  const filteredRouteTokens = useMemo(
    () => filterTokens(availableRouteTokens, chainFilter, trimmedSearch, disabledChains),
    [availableRouteTokens, chainFilter, trimmedSearch, disabledChains],
  );
  const allTokens = useMemo(() => {
    const filteredFetched = filterTokens(fetched, null, undefined, disabledChains);
    return mergeRouteTokensFirst(filteredRouteTokens, filteredFetched);
  }, [fetched, filteredRouteTokens, disabledChains]);

  const directRouteTokenKeys = useMemo(
    () =>
      hasAvailableRoutesResult
        ? new Set(availableRouteTokens.map((token) => getTokenKey(token)))
        : new Set<string>(),
    [availableRouteTokens, hasAvailableRoutesResult],
  );
  const routePriorityTokenKeys = directRouteTokenKeys;
  const tokenRouteMap = useMemo(() => {
    if (selectionMode !== 'destination') return null;
    if (!counterpartToken) return null;
    if (!hasAvailableRoutesResult) return null;

    const routeMap = new Map<string, TokenRouteKind>();
    for (const token of allTokens) {
      const routeKind = getTokenRouteKind(token, directRouteTokenKeys, counterpartToken);
      if (routeKind) routeMap.set(getTokenKey(token), routeKind);
    }
    return routeMap;
  }, [allTokens, counterpartToken, directRouteTokenKeys, hasAvailableRoutesResult, selectionMode]);

  const balanceTokens = allTokens;

  const addressOverride = selectionMode === 'destination' ? recipient : undefined;
  const {
    balances,
    isLoading: isBalanceLoading,
    hasAnyAddress,
  } = useTokenBalances(balanceTokens, chainFilter ?? 'all', addressOverride);
  const { prices } = useTokenPrices();

  const { balanceMap, usdMap } = useMemo(() => {
    const bMap = new Map<string, bigint>();
    const uMap = new Map<string, number>();
    for (const token of balanceTokens) {
      const key = getTokenKey(token);
      const bal = balances[key];
      if (bal != null) {
        bMap.set(key, bal);
        const usd = getUsdValue(token, balances, prices);
        if (usd != null && usd > 0) uMap.set(key, usd);
      }
    }
    return { balanceMap: bMap, usdMap: uMap };
  }, [balanceTokens, balances, prices]);

  const tokens = useMemo(() => {
    const sorted = [...allTokens].sort((a, b) => {
      const aKey = getTokenKey(a);
      const bKey = getTokenKey(b);

      if (routePriorityTokenKeys.size > 0) {
        const aIsDirectRoute = routePriorityTokenKeys.has(aKey);
        const bIsDirectRoute = routePriorityTokenKeys.has(bKey);
        if (aIsDirectRoute && !bIsDirectRoute) return -1;
        if (!aIsDirectRoute && bIsDirectRoute) return 1;
      }

      const aUsd = usdMap.get(aKey) ?? 0;
      const bUsd = usdMap.get(bKey) ?? 0;
      if (aUsd > 0 || bUsd > 0) {
        if (aUsd !== bUsd) return bUsd - aUsd;
      }

      const aBal = balanceMap.get(aKey) ?? 0n;
      const bBal = balanceMap.get(bKey) ?? 0n;
      if (aBal > 0n || bBal > 0n) {
        if (aBal > bBal) return -1;
        if (aBal < bBal) return 1;
      }

      const symbolCompare = a.symbol.localeCompare(b.symbol);
      if (symbolCompare !== 0) return symbolCompare;
      return a.chainName.localeCompare(b.chainName);
    });

    return sorted;
  }, [allTokens, routePriorityTokenKeys, usdMap, balanceMap]);

  const { startIndex, endIndex, offsetTop, totalSize, onScroll } = useVirtualizedList({
    itemCount: tokens.length,
    itemSize: TOKEN_ROW_SIZE,
    overscan: 4,
    scrollRef,
  });
  const visibleTokens = tokens.slice(startIndex, endIndex);

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    onScroll();
  }, [searchQuery, chainFilter, onScroll]);

  if (tokens.length === 0) {
    return (
      <div className="token-picker-empty flex flex-1 flex-col items-center justify-center px-4 py-12 text-gray-500">
        <div className="text-base font-medium">
          {isTokenLoading ? 'Loading tokens…' : 'No tokens found'}
        </div>
        {!isTokenLoading && (
          <div className="mt-2 text-sm">Try a different search or chain filter</div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="token-picker-header z-10 shrink-0 border-b border-primary-50 bg-white px-4 pb-2 pt-2">
        <h3 className={`${styles.base} text-sm text-black`}>Token Selection</h3>
      </div>
      <div
        ref={scrollRef}
        className="token-picker-scroll min-h-0 flex-1 overflow-auto"
        onScroll={onScroll}
      >
        <div className="relative" style={{ height: totalSize + TOKEN_LIST_PADDING }}>
          <div
            className="absolute left-0 right-0 md:px-3"
            style={{ transform: `translateY(${TOKEN_LIST_TOP_PADDING + offsetTop}px)` }}
          >
            {visibleTokens.map((token) => {
              const key = getTokenKey(token);
              const balance = balanceMap.get(key);
              const usdValue = usdMap.get(key) ?? null;

              return (
                <TokenButton
                  key={key}
                  token={token}
                  onSelect={onSelect}
                  balance={balance}
                  usdValue={usdValue}
                  isBalanceLoading={isBalanceLoading && hasAnyAddress}
                  routeKind={tokenRouteMap?.get(key)}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="token-picker-fade pointer-events-none absolute bottom-0 left-0 right-0 hidden h-12 bg-gradient-to-b from-transparent to-cream-200 md:block" />
    </div>
  );
}

const TokenButton = React.memo(function TokenButton({
  token,
  onSelect,
  balance,
  usdValue,
  isBalanceLoading,
  routeKind,
}: {
  token: UiToken;
  onSelect: (token: UiToken) => void;
  balance?: bigint;
  usdValue?: number | null;
  isBalanceLoading: boolean;
  routeKind?: TokenRouteKind;
}) {
  const multiProvider = useMultiProvider();
  const chainDisplayName = getChainDisplayName(multiProvider, token.chainName);
  const formattedBalance = balance != null ? formatBalance(balance, token.decimals) : null;
  const formattedUsd = usdValue != null && usdValue > 0 ? formatUsd(usdValue) : null;

  const primaryValue = formattedUsd ?? formattedBalance;
  const secondaryValue = formattedUsd ? formattedBalance : null;

  return (
    <button
      type="button"
      className="token-picker-row group mb-2 flex h-[60px] w-full items-center rounded-md px-3 transition-colors hover:bg-gray-100"
      onClick={() => onSelect(token)}
    >
      <TokenChainIcon token={token} size={36} />

      <div className="ml-3 min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`token-picker-symbol ${styles.base} text-base text-black`}>
            {token.symbol || 'Unknown'}
          </span>
          <span className="token-picker-chain-name text-xs text-gray-500">{chainDisplayName}</span>
          {routeKind && <RouteKindBadge kind={routeKind} />}
        </div>
        <div className={`token-picker-name ${styles.base} mt-0.5 truncate text-xs text-gray-500`}>
          {token.name || 'Unknown Token'}
        </div>
      </div>

      <div className="ml-2 shrink-0 text-right">
        {isBalanceLoading && !primaryValue ? (
          <div className="token-picker-shimmer mb-1 ml-auto h-4 w-14 animate-pulse rounded bg-gray-100" />
        ) : primaryValue ? (
          <>
            <div className={`token-picker-usd ${styles.base} text-sm font-medium text-black`}>
              {primaryValue}
            </div>
            {secondaryValue && (
              <div className={`token-picker-meta ${styles.base} text-xs text-gray-400`}>
                {secondaryValue}
              </div>
            )}
          </>
        ) : null}
      </div>
    </button>
  );
});

function RouteKindBadge({ kind }: { kind: TokenRouteKind }) {
  const className =
    kind === 'bridge'
      ? 'border-blue-200 bg-blue-50 text-blue-600'
      : 'border-pink-200 bg-pink-50 text-pink-600';

  return (
    <span
      aria-hidden="true"
      data-route-kind={kind}
      className={`rounded border px-1.5 py-0.5 text-[10px] leading-none ${className}`}
    >
      {kind === 'bridge' ? 'Bridge' : 'Swap'}
    </span>
  );
}

function filterTokens(
  tokens: UiToken[],
  chainFilter: ChainName | null,
  search: string | undefined,
  disabledChains: Set<string>,
): UiToken[] {
  return tokens.filter((token) => {
    if (disabledChains.has(token.chainName)) return false;
    if (chainFilter && token.chainName !== chainFilter) return false;
    if (search && !matchesTokenSearch(token, search)) return false;
    return true;
  });
}

function matchesTokenSearch(token: UiToken, search: string): boolean {
  const query = search.toLowerCase();
  return (
    token.symbol.toLowerCase().includes(query) ||
    token.name.toLowerCase().includes(query) ||
    token.address.toLowerCase().includes(query) ||
    token.chainName.toLowerCase().includes(query)
  );
}

const styles = {
  base: 'font-secondary font-normal',
};
