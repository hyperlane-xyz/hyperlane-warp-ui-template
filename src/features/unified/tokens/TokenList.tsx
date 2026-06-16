import { Tooltip, useDebounce } from '@hyperlane-xyz/widgets';
import React, { useEffect, useMemo, useRef } from 'react';

import { TokenChainIcon } from '../../../components/icons/TokenChainIcon';
import { useDisabledChains, useMultiProvider } from '../../chains/hooks';
import { getChainDisplayName } from '../../chains/utils';
import { useCollateralGroups } from '../../tokens/hooks';
import { useUnifiedTokens } from './hooks';
import { getTokenRouteMode, getVisibleUnifiedTokens, type UnifiedTokenRouteMode } from './list';
import type { UnifiedToken } from './types';

function matchesSearch(
  token: UnifiedToken,
  query: string,
  multiProvider: ReturnType<typeof useMultiProvider>,
): boolean {
  return (
    token.name.toLowerCase().includes(query) ||
    token.symbol.toLowerCase().includes(query) ||
    token.addressOrDenom.toLowerCase().includes(query) ||
    getChainDisplayName(multiProvider, token.chainName).toLowerCase().includes(query)
  );
}

interface TokenListProps {
  selectionMode: 'origin' | 'destination';
  searchQuery: string;
  chainFilter: string | null;
  chainIdFilter: number | undefined;
  onSelect: (token: UnifiedToken) => void;
  counterpartToken?: UnifiedToken;
  engineEnabled: boolean;
}

export function TokenList({
  selectionMode,
  searchQuery,
  chainFilter,
  chainIdFilter,
  onSelect,
  counterpartToken,
  engineEnabled,
}: TokenListProps) {
  const multiProvider = useMultiProvider();
  const disabledChains = useDisabledChains();
  const debouncedSearch = useDebounce(searchQuery, 300);
  const trimmedSearch = debouncedSearch?.trim().toLowerCase() || undefined;
  const scrollRef = useRef<HTMLDivElement>(null);
  const collateralGroups = useCollateralGroups();

  const { data: fetched, isLoading } = useUnifiedTokens({
    chain: chainIdFilter,
    search: trimmedSearch,
  });

  const allTokens = useMemo(
    () =>
      disabledChains.size > 0 ? fetched.filter((t) => !disabledChains.has(t.chainName)) : fetched,
    [fetched, disabledChains],
  );

  const { tokens, isLimited } = useMemo(() => {
    const filtered = allTokens.filter((token) => {
      if (chainFilter && token.chainName !== chainFilter) return false;
      if (!trimmedSearch) return true;
      return matchesSearch(token, trimmedSearch, multiProvider);
    });

    return getVisibleUnifiedTokens({
      allTokens: filtered,
      counterpartToken,
      selectionMode,
      collateralGroups,
      engineEnabled,
      hasFilter: !!trimmedSearch || !!chainFilter,
    });
  }, [
    allTokens,
    trimmedSearch,
    chainFilter,
    multiProvider,
    counterpartToken,
    selectionMode,
    collateralGroups,
    engineEnabled,
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [searchQuery, chainFilter]);

  if (tokens.length === 0) {
    return (
      <div className="token-picker-empty flex flex-1 flex-col items-center justify-center px-4 py-12 text-gray-500">
        <div className="text-base font-medium">
          {isLoading ? 'Loading tokens…' : 'No tokens found'}
        </div>
        {!isLoading && <div className="mt-2 text-sm">Try a different search or chain filter</div>}
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
            const routeMode = getTokenRouteMode(
              token,
              counterpartToken,
              selectionMode,
              collateralGroups,
              engineEnabled,
            );

            return (
              <TokenButton
                key={token.key}
                token={token}
                onSelect={onSelect}
                routeMode={routeMode}
                counterpartToken={counterpartToken}
                selectionMode={selectionMode}
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
  routeMode,
  counterpartToken,
  selectionMode,
}: {
  token: UnifiedToken;
  onSelect: (token: UnifiedToken) => void;
  routeMode: UnifiedTokenRouteMode;
  counterpartToken?: UnifiedToken;
  selectionMode: 'origin' | 'destination';
}) {
  const multiProvider = useMultiProvider();
  const chainDisplayName = getChainDisplayName(multiProvider, token.chainName);
  const counterpartChainName = counterpartToken
    ? getChainDisplayName(multiProvider, counterpartToken.chainName)
    : '';
  const showRouteUnavailable = !routeMode && counterpartToken;
  const routeDirection = selectionMode === 'destination' ? 'from' : 'to';
  const routeTooltipMessage = counterpartToken
    ? `No route ${routeDirection} ${counterpartToken.symbol} on ${counterpartChainName}`
    : '';

  return (
    <button
      type="button"
      className="token-picker-row group mb-2 flex h-[60px] w-full items-center rounded-md px-3 transition-colors hover:bg-gray-100"
      onClick={() => onSelect(token)}
    >
      <TokenChainIcon token={token} size={36} />

      <div className="ml-3 grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(4rem,max-content)] items-center gap-3">
        <div className="min-w-0 text-left">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`token-picker-symbol ${styles.base} max-w-[8rem] shrink-0 truncate text-base text-black`}
            >
              {token.symbol || 'Unknown'}
            </span>
            <span className="token-picker-chain-name min-w-0 truncate text-xs text-gray-500">
              {chainDisplayName}
            </span>
          </div>
          <div className={`token-picker-name ${styles.base} mt-0.5 truncate text-xs text-gray-500`}>
            {token.name || 'Unknown Token'}
          </div>
        </div>

        <div className="justify-self-end text-right">
          {showRouteUnavailable && (
            <div className="flex items-center justify-end gap-1 whitespace-nowrap text-[10px] text-gray-400">
              <span>Route unavailable</span>
              <Tooltip
                content={routeTooltipMessage}
                id={`route-tooltip-${token.key}`}
                tooltipClassName="token-picker-info-icon max-w-[280px]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

const styles = {
  base: 'font-secondary font-normal',
};
