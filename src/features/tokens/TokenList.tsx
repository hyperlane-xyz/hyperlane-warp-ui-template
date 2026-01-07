import { Token } from '@hyperlane-xyz/sdk';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useCollateralGroups, useTokens } from './hooks';
import { TokenChainIcon } from './TokenChainIcon';
import { TokenSelectionMode } from './types';
import { checkTokenHasRoute, getTokenKey } from './utils';

interface TokenListProps {
  selectionMode: TokenSelectionMode;
  searchQuery: string;
  chainFilter: ChainName | null;
  onSelect: (token: Token) => void;
  counterpartToken?: Token;
}

export function TokenList({
  selectionMode,
  searchQuery,
  chainFilter,
  onSelect,
  counterpartToken,
}: TokenListProps) {
  const multiProvider = useMultiProvider();
  const allTokens = useTokens();

  // Pre-computed collateral groups from store (computed at app startup)
  const collateralGroups = useCollateralGroups();

  // Deferred state for route map - allows UI to render immediately
  const [tokenRouteMap, setTokenRouteMap] = useState<Map<string, boolean> | null>(null);
  const [, startTransition] = useTransition();

  // Compute route map in a transition (non-blocking)
  useEffect(() => {
    if (!counterpartToken) {
      setTokenRouteMap(null);
      return;
    }

    startTransition(() => {
      const routeMap = new Map<string, boolean>();

      for (const token of allTokens) {
        const key = getTokenKey(token);
        // Determine origin/destination based on selection mode
        const originToken = selectionMode === 'origin' ? token : counterpartToken;
        const destToken = selectionMode === 'origin' ? counterpartToken : token;
        const hasRoute = checkTokenHasRoute(originToken, destToken, collateralGroups);
        routeMap.set(key, hasRoute);
      }

      setTokenRouteMap(routeMap);
    });
  }, [allTokens, counterpartToken, selectionMode, collateralGroups]);

  const { tokens, totalCount, isLimited } = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase();

    // Filter by chain
    const chainFiltered = chainFilter
      ? allTokens.filter((t) => t.chainName === chainFilter)
      : allTokens;

    // Filter by search query
    const filtered = chainFiltered.filter((t) => {
      if (!q) return true;
      const chainDisplayName = getChainDisplayName(multiProvider, t.chainName).toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.addressOrDenom.toLowerCase().includes(q) ||
        chainDisplayName.includes(q)
      );
    });

    // Sort: tokens with routes first, then by symbol, then by chain name
    const sorted = [...filtered].sort((a, b) => {
      // If we have route info, sort tokens with routes first
      if (tokenRouteMap) {
        const aHasRoute = tokenRouteMap.get(getTokenKey(a)) ?? true;
        const bHasRoute = tokenRouteMap.get(getTokenKey(b)) ?? true;

        if (aHasRoute && !bHasRoute) return -1;
        if (!aHasRoute && bHasRoute) return 1;
      }

      // Then sort alphabetically by symbol
      const symbolCompare = a.symbol.localeCompare(b.symbol);
      if (symbolCompare !== 0) return symbolCompare;
      return a.chainName.localeCompare(b.chainName);
    });

    // Limit display when no filters applied (for performance with large token lists)
    const hasFilter = !!q || chainFilter !== null;
    const maxDisplay = 50;
    const isLimited = !hasFilter && sorted.length > maxDisplay;
    const displayTokens = isLimited ? sorted.slice(0, maxDisplay) : sorted;

    return {
      tokens: displayTokens,
      totalCount: sorted.length,
      isLimited,
    };
  }, [searchQuery, chainFilter, allTokens, multiProvider, tokenRouteMap]);

  if (tokens.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-gray-500">
        <div className="text-base font-medium">No tokens found</div>
        <div className="mt-2 text-sm">Try a different search or chain filter</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-3 py-2">
      {tokens.map((token) => {
        const tokenKey = getTokenKey(token);
        // If no counterpart selected (tokenRouteMap is null), all tokens have routes
        const hasRoute = tokenRouteMap ? (tokenRouteMap.get(tokenKey) ?? true) : true;

        return <TokenButton key={tokenKey} token={token} onSelect={onSelect} hasRoute={hasRoute} />;
      })}

      {isLimited && (
        <div className="mx-1 mb-3 mt-2 rounded-lg bg-blue-50 p-3 text-center">
          <p className="text-sm text-blue-800">
            Showing {tokens.length} of {totalCount} tokens
          </p>
          <p className="mt-1 text-xs text-blue-600">Use search or select a chain to see more</p>
        </div>
      )}
    </div>
  );
}

function TokenButton({
  token,
  onSelect,
  hasRoute,
}: {
  token: Token;
  onSelect: (token: Token) => void;
  /** Whether this token has a valid route to/from the counterpart. False = grayed appearance */
  hasRoute: boolean;
}) {
  const multiProvider = useMultiProvider();
  const chainDisplayName = getChainDisplayName(multiProvider, token.chainName);

  // Truncate address for display
  const shortAddress = token.addressOrDenom
    ? `${token.addressOrDenom.slice(0, 6)}...${token.addressOrDenom.slice(-4)}`
    : 'Native';

  return (
    <button
      type="button"
      className={`group mb-1.5 flex w-full items-center rounded-lg border border-transparent px-3 py-2.5 transition-all hover:border-gray-200 hover:bg-gray-50 ${
        !hasRoute ? 'opacity-40' : ''
      }`}
      onClick={() => onSelect(token)}
    >
      <TokenChainIcon token={token} size={36} />

      <div className="ml-3 min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${hasRoute ? 'text-gray-900' : 'text-gray-500'}`}>
            {token.symbol || 'Unknown'}
          </span>
          <span className="text-xs text-gray-500">{chainDisplayName}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-gray-500">{token.name || 'Unknown Token'}</div>
      </div>

      <div className="ml-2 shrink-0 text-right">
        <div className="font-mono text-[10px] text-gray-400">{shortAddress}</div>
      </div>
    </button>
  );
}
