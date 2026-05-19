import { ChainName } from '@hyperlane-xyz/sdk';
import { Tooltip, useDebounce } from '@hyperlane-xyz/widgets';
import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { TokenChainIcon } from '../../../components/icons/TokenChainIcon';
import { useDisabledChains, useMultiProvider } from '../../chains/hooks';
import { getChainDisplayName } from '../../chains/utils';
import { useTokenBalances } from '../balances/hooks';
import { formatBalance, formatUsd, getUsdValue } from '../balances/utils';
import { useTokens } from './hooks';
import type { TokenSelectionMode, UiToken } from './types';
import { useTokenPrices } from './useTokenPrice';
import { checkTokenHasRoute, getTokenKey } from './utils';

interface TokenListProps {
  selectionMode: TokenSelectionMode;
  searchQuery: string;
  chainFilter: ChainName | null;
  onSelect: (token: UiToken) => void;
  counterpartToken?: UiToken;
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
  const disabledChains = useDisabledChains();
  const debouncedSearch = useDebounce(searchQuery, 300);
  const trimmedSearch = debouncedSearch?.trim() || undefined;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Map chainName filter → chainId for the engine query. tryGetChainMetadata
  // returns null until multiProvider hydrates; useTokens internally skips
  // tokens for unknown chains so an early-render miss is harmless.
  const chainId = useMemo(() => {
    if (!chainFilter) return undefined;
    return multiProvider.tryGetChainMetadata(chainFilter)?.chainId as number | undefined;
  }, [chainFilter, multiProvider]);

  // Server-side filtering — engine handles chain/search; the picker stops
  // doing local matchesSearch + chainFilter predicates.
  const { data: fetched, isLoading: isTokenLoading } = useTokens({
    chain: chainId,
    search: trimmedSearch,
  });
  const allTokens = useMemo(
    () =>
      disabledChains.size > 0 ? fetched.filter((t) => !disabledChains.has(t.chainName)) : fetched,
    [fetched, disabledChains],
  );

  // Engine governs route availability per (srcChain, srcToken, dstChain,
  // dstToken) tuple. Without an engine route-matrix endpoint we treat
  // every token as routable; the user finds out at /v1/quote time.
  const [tokenRouteMap, setTokenRouteMap] = useState<Map<string, boolean> | null>(null);
  const [, startTransition] = useTransition();

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

  const { tokens, isLimited } = useMemo(() => {
    const sorted = [...allTokens].sort((a, b) => {
      const aKey = getTokenKey(a);
      const bKey = getTokenKey(b);

      if (tokenRouteMap) {
        const aHasRoute = tokenRouteMap.get(aKey) ?? true;
        const bHasRoute = tokenRouteMap.get(bKey) ?? true;
        if (aHasRoute && !bHasRoute) return -1;
        if (!aHasRoute && bHasRoute) return 1;
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

    const hasFilter = !!trimmedSearch || !!chainFilter;
    const maxDisplay = 50;
    const shouldCap = !hasFilter;
    const isLimited = shouldCap && sorted.length > maxDisplay;
    const displayTokens = isLimited ? sorted.slice(0, maxDisplay) : sorted;

    return { tokens: displayTokens, isLimited };
  }, [allTokens, trimmedSearch, chainFilter, tokenRouteMap, usdMap, balanceMap]);

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
        const hasRoute = checkTokenHasRoute(originToken, destToken);
        routeMap.set(key, hasRoute);
      }
      setTokenRouteMap(routeMap);
    });
  }, [allTokens, counterpartToken, selectionMode]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [searchQuery, chainFilter]);

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
    <div className="relative flex-1 overflow-hidden">
      <div ref={scrollRef} className="h-full overflow-auto">
        <div className="token-picker-header sticky top-0 z-10 border-b border-primary-50 bg-white px-4 pb-2 pt-2">
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
            <div className="token-picker-hint mx-1 mb-3 mt-2 rounded-lg bg-blue-50 px-3 py-4 text-center">
              <p className="text-sm text-blue-600">Search or select a chain to see more tokens</p>
            </div>
          )}
          <div className="h-10" />
        </div>
      </div>
      <div className="token-picker-fade pointer-events-none absolute bottom-0 left-0 right-0 hidden h-12 bg-gradient-to-b from-transparent to-cream-200 md:block" />
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
  token: UiToken;
  onSelect: (token: UiToken) => void;
  hasRoute: boolean;
  counterpartToken?: UiToken;
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
        {showRouteUnavailable && (
          <div className="flex items-center justify-end gap-1 whitespace-nowrap text-[10px] text-gray-400">
            <span>Route unavailable</span>
            <Tooltip
              content={routeTooltipMessage}
              id={`route-tooltip-${getTokenKey(token)}`}
              tooltipClassName="token-picker-info-icon max-w-[280px]"
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
