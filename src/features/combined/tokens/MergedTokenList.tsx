import { ChainName } from '@hyperlane-xyz/sdk';
import { Tooltip, useDebounce } from '@hyperlane-xyz/widgets';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { TokenChainIcon } from '../../../components/icons/TokenChainIcon';
import { useDisabledChains, useMultiProvider } from '../../chains/hooks';
import { getChainDisplayName } from '../../chains/utils';
import { useTokenBalances } from '../../swap/balances/hooks';
import { formatBalance, formatUsd, getUsdValue } from '../../swap/balances/utils';
import { useTokens as useEngineTokens } from '../../swap/tokens/hooks';
import { useTokenPrices } from '../../swap/tokens/useTokenPrice';
import { getTokenKey } from '../../swap/tokens/utils';
import type { TokenSelectionMode } from '../../swap/tokens/types';
import type { CombinedToken } from '../types';

const BRIDGE_BADGE_CLASSES =
  'ml-1 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
const SWAP_BADGE_CLASSES =
  'ml-1 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';

interface MergedTokenListProps {
  selectionMode: TokenSelectionMode;
  searchQuery: string;
  chainFilter: ChainName | null;
  onSelect: (token: CombinedToken) => void;
  counterpartToken?: CombinedToken;
  // WarpCore destination tokens injected when a source token is selected.
  // The list merges these with engine tokens, deduped by chainId-address.
  extraTokens?: CombinedToken[];
  recipient?: string;
}

export function MergedTokenList({
  selectionMode,
  searchQuery,
  chainFilter,
  onSelect,
  counterpartToken,
  extraTokens = [],
  recipient,
}: MergedTokenListProps) {
  const multiProvider = useMultiProvider();
  const disabledChains = useDisabledChains();
  const debouncedSearch = useDebounce(searchQuery, 300);
  const trimmedSearch = debouncedSearch?.trim() || undefined;
  const scrollRef = useRef<HTMLDivElement>(null);

  const chainId = useMemo(() => {
    if (!chainFilter) return undefined;
    return multiProvider.tryGetChainMetadata(chainFilter)?.chainId as number | undefined;
  }, [chainFilter, multiProvider]);

  const { data: fetched, isLoading: isTokenLoading } = useEngineTokens({
    chain: chainId,
    search: trimmedSearch,
  });

  // Merge engine tokens + extraTokens (WarpCore destinations), deduped by chainId-address.
  // HypNative tokens use the router contract as address (not 0x000...), so they need
  // secondary dedup by (chainId, isNative=true) when direct address lookup fails.
  const allTokens = useMemo<CombinedToken[]>(() => {
    const map = new Map<string, CombinedToken>();

    for (const t of fetched) {
      if (disabledChains.has(t.chainName)) continue;
      map.set(getTokenKey(t), { ...t });
    }

    for (const t of extraTokens) {
      if (disabledChains.has(t.chainName)) continue;
      // When a chain filter is active, only include WarpCore tokens from that chain.
      // Without this, scrolling would reveal WarpCore tokens from every chain mixed in.
      if (chainFilter && t.chainName !== chainFilter) continue;
      const key = getTokenKey(t);
      if (map.has(key)) {
        // Direct address match: enrich engine token with bridge capability.
        // Prefer symbol-matching warpCoreKey — multiple WarpCore tokens can share the
        // same collateral address (e.g. USDC and USDCSTAGE) and we don't want a staging
        // variant to overwrite the key set by the real token.
        const existing = map.get(key)!;
        const shouldUpdateKey = !existing.warpCoreKey || t.symbol === existing.symbol;
        map.set(key, { ...existing, warpCoreKey: shouldUpdateKey ? t.warpCoreKey : existing.warpCoreKey, canBridge: true });
      } else if (t.isNative) {
        // HypNative secondary dedup: find engine native token on same chain.
        let found = false;
        for (const [k, existing] of map) {
          if (existing.chainId === t.chainId && existing.isNative) {
            map.set(k, { ...existing, warpCoreKey: t.warpCoreKey, canBridge: true });
            found = true;
            break;
          }
        }
        if (!found) map.set(key, t);
      } else {
        map.set(key, t);
      }
    }

    return Array.from(map.values());
  }, [fetched, extraTokens, disabledChains]);

  const [tokenRouteMap] = useState<Map<string, boolean> | null>(null);

  const addressOverride = selectionMode === 'destination' ? recipient : undefined;
  const {
    balances,
    isLoading: isBalanceLoading,
    hasAnyAddress,
  } = useTokenBalances(allTokens, chainFilter ?? 'all', addressOverride);
  const { prices } = useTokenPrices();

  const { balanceMap, usdMap } = useMemo(() => {
    const bMap = new Map<string, bigint>();
    const uMap = new Map<string, number>();
    for (const token of allTokens) {
      const key = getTokenKey(token);
      const bal = balances[key];
      if (bal != null) {
        bMap.set(key, bal);
        const usd = getUsdValue(token, balances, prices);
        if (usd != null && usd > 0) uMap.set(key, usd);
      }
    }
    return { balanceMap: bMap, usdMap: uMap };
  }, [allTokens, balances, prices]);

  const { tokens, isLimited } = useMemo(() => {
    const sorted = [...allTokens].sort((a, b) => {
      const aKey = getTokenKey(a);
      const bKey = getTokenKey(b);

      // WarpCore-known tokens (canBridge) first within their bucket.
      if (a.canBridge && !b.canBridge) return -1;
      if (!a.canBridge && b.canBridge) return 1;

      const aUsd = usdMap.get(aKey) ?? 0;
      const bUsd = usdMap.get(bKey) ?? 0;
      if (aUsd !== bUsd) return bUsd - aUsd;

      const aBal = balanceMap.get(aKey) ?? 0n;
      const bBal = balanceMap.get(bKey) ?? 0n;
      if (aBal > bBal) return -1;
      if (aBal < bBal) return 1;

      const symbolCompare = a.symbol.localeCompare(b.symbol);
      if (symbolCompare !== 0) return symbolCompare;
      return a.chainName.localeCompare(b.chainName);
    });

    const hasFilter = !!trimmedSearch || !!chainFilter;
    const maxDisplay = 50;
    const shouldCap = !hasFilter;
    const isLimited = shouldCap && sorted.length > maxDisplay;
    return { tokens: isLimited ? sorted.slice(0, maxDisplay) : sorted, isLimited };
  }, [allTokens, trimmedSearch, chainFilter, usdMap, balanceMap]);

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
          <h3 className="font-secondary text-sm font-normal text-black">Token Selection</h3>
        </div>
        <div className="py-2 md:px-3">
          {tokens.map((token) => {
            const key = getTokenKey(token);
            const hasRoute = tokenRouteMap ? (tokenRouteMap.get(key) ?? true) : true;
            const balance = balanceMap.get(key);
            const usdValue = usdMap.get(key) ?? null;

            return (
              <MergedTokenButton
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

const MergedTokenButton = React.memo(function MergedTokenButton({
  token,
  onSelect,
  hasRoute,
  counterpartToken,
  selectionMode,
  balance,
  usdValue,
  isBalanceLoading,
}: {
  token: CombinedToken;
  onSelect: (token: CombinedToken) => void;
  hasRoute: boolean;
  counterpartToken?: CombinedToken;
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

  const showBadges = selectionMode === 'destination';
  const isBridgeable = showBadges && !!token.warpCoreKey;
  const isSwappable = showBadges && token.canSwap && !isBridgeable;

  return (
    <button
      type="button"
      className="token-picker-row group mb-2 flex h-[60px] w-full items-center rounded-md px-3 transition-colors hover:bg-gray-100"
      onClick={() => onSelect(token)}
    >
      <TokenChainIcon token={token} size={36} />

      <div className="ml-3 min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1">
          <span className="font-secondary text-base font-normal text-black">
            {token.symbol || 'Unknown'}
          </span>
          {isBridgeable && <span className={BRIDGE_BADGE_CLASSES}>Bridge</span>}
          {isSwappable && <span className={SWAP_BADGE_CLASSES}>Swap</span>}
          <span className="text-xs text-gray-500">{chainDisplayName}</span>
        </div>
        <div className="mt-0.5 truncate font-secondary text-xs font-normal text-gray-500">
          {token.name || 'Unknown Token'}
        </div>
      </div>

      <div className="ml-2 shrink-0 text-right">
        {isBalanceLoading && !primaryValue ? (
          <div className="token-picker-shimmer mb-1 ml-auto h-4 w-14 animate-pulse rounded bg-gray-100" />
        ) : primaryValue ? (
          <>
            <div className="font-secondary text-sm font-medium text-black">{primaryValue}</div>
            {secondaryValue && (
              <div className="font-secondary text-xs font-normal text-gray-400">{secondaryValue}</div>
            )}
          </>
        ) : null}
        {showRouteUnavailable && (
          <div className="flex items-center justify-end gap-1 whitespace-nowrap text-[10px] text-gray-400">
            <span>Route unavailable</span>
            <Tooltip
              content={routeTooltipMessage}
              id={`route-tooltip-${getTokenKey(token)}`}
              tooltipClassName="max-w-[280px]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </button>
  );
});
