import { ChainName, Token } from '@hyperlane-xyz/sdk';
import { Tooltip, useDebounce } from '@hyperlane-xyz/widgets';
import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { config } from '../../consts/config';
import { useTokenBalances } from '../balances/hooks';
import { tokenKey } from '../balances/tokens';
import { formatBalance, formatUsd, getUsdValue } from '../balances/utils';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useCollateralGroups, useTokens } from './hooks';
import { TokenChainIcon } from './TokenChainIcon';
import { TokenSelectionMode } from './types';
import { useTokenPrices } from './useTokenPrice';
import { checkTokenHasRoute, getTokenKey } from './utils';

const featuredSet = new Set(config.featuredTokens.map((t) => t.toLowerCase()));

function isFeaturedToken(token: Token): boolean {
  return featuredSet.has(`${token.chainName}-${token.symbol}`.toLowerCase());
}

interface TokenListProps {
  selectionMode: TokenSelectionMode;
  searchQuery: string;
  chainFilter: ChainName | null;
  onSelect: (token: Token) => void;
  counterpartToken?: Token;
  /** Recipient address for destination balance lookups */
  recipient?: string;
}

export function TokenList({
  selectionMode,
  searchQuery,
  chainFilter,
  onSelect,
  counterpartToken,
  recipient,
}: TokenListProps) {
  const multiProvider = useMultiProvider();
  const allTokens = useTokens();
  const collateralGroups = useCollateralGroups();
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Deferred state for route map - allows UI to render immediately
  const [tokenRouteMap, setTokenRouteMap] = useState<Map<string, boolean> | null>(null);
  const [, startTransition] = useTransition();

  // Compute route map in a transition (non-blocking)
  useEffect(() => {
    startTransition(() => {
      if (!counterpartToken) {
        setTokenRouteMap(null);
        return;
      }

      const routeMap = new Map<string, boolean>();

      for (const token of allTokens) {
        const key = getTokenKey(token);
        const originToken = selectionMode === 'origin' ? token : counterpartToken;
        const destToken = selectionMode === 'origin' ? counterpartToken : token;
        const hasRoute = checkTokenHasRoute(originToken, destToken, collateralGroups);
        routeMap.set(key, hasRoute);
      }

      setTokenRouteMap(routeMap);
    });
  }, [allTokens, counterpartToken, selectionMode, collateralGroups]);

  // Tokens we care about: featured + routable
  const relevantTokens = useMemo(() => {
    return allTokens.filter((t) => {
      if (isFeaturedToken(t)) return true;
      if (tokenRouteMap) return tokenRouteMap.get(getTokenKey(t)) ?? false;
      return false;
    });
  }, [allTokens, tokenRouteMap]);

  // Balance fetch set: relevant + chain filter + search matches
  // Expands when user picks a chain or searches, so those tokens get balances too
  const balanceTokens = useMemo(() => {
    const q = debouncedSearch?.trim().toLowerCase();
    if (!chainFilter && !q) return relevantTokens;
    const seen = new Set(relevantTokens.map((t) => getTokenKey(t)));
    const merged = [...relevantTokens];
    for (const t of allTokens) {
      const key = getTokenKey(t);
      if (seen.has(key)) continue;
      const chainMatch = chainFilter && t.chainName === chainFilter;
      const searchMatch =
        q &&
        (t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.addressOrDenom.toLowerCase().includes(q) ||
          t.collateralAddressOrDenom?.toLowerCase().includes(q));
      if (chainMatch || searchMatch) {
        seen.add(key);
        merged.push(t);
      }
    }
    return merged;
  }, [relevantTokens, chainFilter, debouncedSearch, allTokens]);

  // Fetch balances for relevant + chain-filtered tokens only
  // For destination mode, use recipient address if provided
  const {
    balances,
    isLoading: isBalanceLoading,
    hasAnyAddress,
  } = useTokenBalances(
    balanceTokens,
    chainFilter ?? ('default' as ChainName),
    'all' as ChainName,
    recipient,
  );
  const { prices } = useTokenPrices();

  // Build lookup maps: getTokenKey → balance/usdValue
  const { balanceMap, usdMap } = useMemo(() => {
    const bMap = new Map<string, bigint>();
    const uMap = new Map<string, number>();
    for (const token of balanceTokens) {
      const tKey = tokenKey(token);
      const gKey = getTokenKey(token);
      const bal = balances[tKey];
      if (bal != null && bal > 0n) {
        bMap.set(gKey, bal);
        const usd = getUsdValue(token, balances, prices);
        if (usd != null && usd > 0) uMap.set(gKey, usd);
      }
    }
    return { balanceMap: bMap, usdMap: uMap };
  }, [balanceTokens, balances, prices]);

  const { tokens, totalCount, isLimited } = useMemo(() => {
    const q = debouncedSearch?.trim().toLowerCase();

    // Default view: only relevant tokens (featured + routable)
    // Search/chain filter: expand to all tokens so user can discover
    const baseTokens = q || chainFilter ? allTokens : relevantTokens;

    // Filter by chain
    const chainFiltered = chainFilter
      ? baseTokens.filter((t) => t.chainName === chainFilter)
      : baseTokens;

    // Filter by search query
    const filtered = chainFiltered.filter((t) => {
      if (!q) return true;
      const chainDisplayName = getChainDisplayName(multiProvider, t.chainName).toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.addressOrDenom.toLowerCase().includes(q) ||
        t.collateralAddressOrDenom?.toLowerCase().includes(q) ||
        chainDisplayName.includes(q)
      );
    });

    const hasFilter = !!q || chainFilter !== null;

    // Multi-tier sort
    const sorted = [...filtered].sort((a, b) => {
      const aKey = getTokenKey(a);
      const bKey = getTokenKey(b);

      // 1. Has route to counterpart (true first)
      if (tokenRouteMap) {
        const aHasRoute = tokenRouteMap.get(aKey) ?? true;
        const bHasRoute = tokenRouteMap.get(bKey) ?? true;
        if (aHasRoute && !bHasRoute) return -1;
        if (!aHasRoute && bHasRoute) return 1;
      }

      // 2. Featured tokens first — only in default view (no filter/search)
      if (!hasFilter) {
        const aFeatured = isFeaturedToken(a);
        const bFeatured = isFeaturedToken(b);
        if (aFeatured && !bFeatured) return -1;
        if (!aFeatured && bFeatured) return 1;
      }

      // 3. Has balance with USD value (desc)
      const aUsd = usdMap.get(aKey) ?? 0;
      const bUsd = usdMap.get(bKey) ?? 0;
      if (aUsd > 0 || bUsd > 0) {
        if (aUsd !== bUsd) return bUsd - aUsd;
      }

      // 4. Has balance without USD (desc by raw amount)
      const aBal = balanceMap.get(aKey) ?? 0n;
      const bBal = balanceMap.get(bKey) ?? 0n;
      if (aBal > 0n || bBal > 0n) {
        if (aBal > bBal) return -1;
        if (aBal < bBal) return 1;
      }

      // 5. Symbol alphabetical
      const symbolCompare = a.symbol.localeCompare(b.symbol);
      if (symbolCompare !== 0) return symbolCompare;

      // 6. Chain name alphabetical
      return a.chainName.localeCompare(b.chainName);
    });

    // Limit display when no filters applied
    const maxDisplay = 50;
    const isLimited = !hasFilter && sorted.length > maxDisplay;
    const displayTokens = isLimited ? sorted.slice(0, maxDisplay) : sorted;

    return {
      tokens: displayTokens,
      totalCount: sorted.length,
      isLimited,
    };
  }, [
    debouncedSearch,
    chainFilter,
    allTokens,
    relevantTokens,
    multiProvider,
    tokenRouteMap,
    usdMap,
    balanceMap,
  ]);

  if (tokens.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-gray-500">
        <div className="text-base font-medium">No tokens found</div>
        <div className="mt-2 text-sm">Try a different search or chain filter</div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="h-full overflow-auto">
        <div className="sticky top-0 z-10 border-b border-primary-50 bg-white px-4 pb-2 pt-2">
          <h3 className={`${styles.base} text-sm text-black`}>Token Selection</h3>
        </div>
        <div className="py-2 md:px-3">
          {tokens.map((token) => {
            const key = getTokenKey(token);
            const hasRoute = tokenRouteMap ? (tokenRouteMap.get(key) ?? true) : true;
            const balance = balanceMap.get(key);
            const usdValue = usdMap.get(key) ?? null;

            return (
              <TokenButton
                key={key}
                token={token}
                onSelect={onSelect}
                hasRoute={hasRoute}
                counterpartToken={counterpartToken}
                selectionMode={selectionMode}
                balance={balance}
                usdValue={usdValue}
                isBalanceLoading={isBalanceLoading && hasAnyAddress}
              />
            );
          })}

          {isLimited && (
            <div className="mx-1 mb-3 mt-2 rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-sm text-blue-800">
                Showing {tokens.length} of {totalCount} tokens
              </p>
              <p className="mt-1 text-xs text-blue-600">Use search or select a chain to see more</p>
            </div>
          )}
          {/* Spacer for fade effect */}
          <div className="h-10" />
        </div>
      </div>
      {/* Bottom fade effect */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 hidden h-12 bg-gradient-to-b from-transparent to-cream-200 md:block" />
    </div>
  );
}

const TokenButton = React.memo(function TokenButton({
  token,
  onSelect,
  hasRoute,
  counterpartToken,
  selectionMode,
  balance,
  usdValue,
  isBalanceLoading,
}: {
  token: Token;
  onSelect: (token: Token) => void;
  hasRoute: boolean;
  counterpartToken?: Token;
  selectionMode: TokenSelectionMode;
  balance?: bigint;
  usdValue?: number | null;
  isBalanceLoading: boolean;
}) {
  const multiProvider = useMultiProvider();
  const chainDisplayName = getChainDisplayName(multiProvider, token.chainName);
  const counterpartChainName = counterpartToken
    ? getChainDisplayName(multiProvider, counterpartToken.chainName)
    : '';

  const routeDirection = selectionMode === 'destination' ? 'from' : 'to';
  const routeTooltipMessage = counterpartToken
    ? `No route ${routeDirection} ${counterpartToken.symbol} on ${counterpartChainName}`
    : '';

  const formattedBalance = balance != null ? formatBalance(balance, token.decimals) : null;
  const formattedUsd = usdValue != null && usdValue > 0 ? formatUsd(usdValue) : null;
  const showRouteUnavailable = !hasRoute && counterpartToken;

  // Primary = USD if available, else balance. Secondary = balance when USD is primary.
  const primaryValue = formattedUsd ?? formattedBalance;
  const secondaryValue = formattedUsd ? formattedBalance : null;

  return (
    <button
      type="button"
      className="group mb-2 flex h-[60px] w-full items-center rounded-[3px] px-3 transition-colors hover:bg-gray-100"
      onClick={() => onSelect(token)}
    >
      <TokenChainIcon token={token} size={36} />

      <div className="ml-3 min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`${styles.base} text-base text-black`}>{token.symbol || 'Unknown'}</span>
          <span className="text-xs text-gray-500">{chainDisplayName}</span>
        </div>
        <div className={`${styles.base} mt-0.5 truncate text-xs text-gray-500`}>
          {token.name || 'Unknown Token'}
        </div>
      </div>

      <div className="ml-2 shrink-0 text-right">
        {isBalanceLoading && !primaryValue ? (
          <div className="mb-1 ml-auto h-4 w-14 animate-pulse rounded bg-gray-100" />
        ) : primaryValue ? (
          <>
            <div className={`${styles.base} text-sm font-medium text-black`}>{primaryValue}</div>
            {secondaryValue && (
              <div className={`${styles.base} text-xs text-gray-400`}>{secondaryValue}</div>
            )}
          </>
        ) : null}
        {showRouteUnavailable && (
          <div className="flex items-center justify-end gap-1 whitespace-nowrap text-[10px] text-gray-400">
            <span>Route unavailable</span>
            <Tooltip
              content={routeTooltipMessage}
              id={`route-tooltip-${getTokenKey(token)}`}
              tooltipClassName="max-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </button>
  );
});

const styles = {
  base: 'font-secondary font-normal',
};
