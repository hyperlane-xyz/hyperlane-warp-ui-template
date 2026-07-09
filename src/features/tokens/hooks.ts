import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useChains } from '../api/hooks';
import { routerClient } from '../api/RouterClient';
import type { TokensQuery } from '../api/types';
import { useStore } from '../store';
import { tokenDiscoveryToUi, type TokenSelectionMode, type UiToken } from './types';

const STALE_5_MIN = 5 * 60 * 1000;
export const AVAILABLE_ROUTES_STALE_TIME = 10 * 60 * 1000;
const STALE_30_SEC = 30 * 1000;

interface UseTokensResult {
  data: UiToken[];
  isLoading: boolean;
  error: Error | null;
}

interface UseAvailableRouteTokensResult {
  data: UiToken[];
  isLoading: boolean;
  error: Error | null;
  isFetched: boolean;
}

// Single entry point for /v1/tokens. Branches map directly to engine
// modes (see RouterClient.tokens / TokensQuery):
//   {}              → featured / trending list
//   { chain }       → per-chain list
//   { chain, search}→ per-chain filtered
//   { search }      → cross-chain search
//   { ids }         → explicit lookups, used for ?originToken= deep links
//
// Side-effect: each successful response funnels into store.knownTokens
// so ad-hoc lookups in modals/sidebar can resolve any token the user
// has touched in this session, not just the featured list.
export function useTokens(query: TokensQuery = {}): UseTokensResult {
  const { data: chainsResp, isLoading: chainsLoading } = useChains();
  const syncTokens = useStore((s) => s.syncTokens);

  // Engine chains are the source of truth for what `/v1/tokens` can
  // return.
  const chainIdToName = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of chainsResp?.chains ?? []) map.set(c.id, c.chainName);
    return map;
  }, [chainsResp]);

  // Canonicalize the query for cache-key stability.
  const canonical = useMemo<TokensQuery>(() => {
    const out: TokensQuery = {};
    if (query.ids?.length) out.ids = [...query.ids].sort();
    else {
      if (query.chain != null) out.chain = query.chain;
      if (query.search) out.search = query.search;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.chain, query.search, query.ids?.join(',')]);

  const result = useQuery({
    queryKey: ['router', 'tokens', canonical],
    queryFn: () => routerClient.tokens(canonical),
    staleTime: canonical.search ? STALE_30_SEC : STALE_5_MIN,
  });

  const tokens = useMemo<UiToken[]>(() => {
    if (!result.data) return [];
    const out: UiToken[] = [];
    for (const t of result.data.tokens) {
      if (t.decimals == null) continue;
      // Skip tokens whose chainId isn't yet in /v1/chains — chainsResp
      // is the source of truth for chainName, and without it the token
      // has no logo / display name. The hook surfaces `chainsLoading`
      // upstream so callers see the loading state.
      const chainName = chainIdToName.get(t.chainId);
      if (!chainName) continue;
      out.push(tokenDiscoveryToUi(t, chainName));
    }
    return out;
  }, [result.data, chainIdToName]);

  useEffect(() => {
    if (tokens.length) syncTokens(tokens);
  }, [tokens, syncTokens]);

  return {
    data: tokens,
    isLoading: chainsLoading || result.isLoading,
    error: result.error,
  };
}

export function useAvailableRouteTokens({
  selectionMode,
  counterpartToken,
  enabled,
}: {
  selectionMode: TokenSelectionMode;
  counterpartToken?: UiToken;
  enabled: boolean;
}): UseAvailableRouteTokensResult {
  const { data: chainsResp, isLoading: chainsLoading } = useChains();
  const syncTokens = useStore((s) => s.syncTokens);

  const chainIdToName = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of chainsResp?.chains ?? []) map.set(c.id, c.chainName);
    return map;
  }, [chainsResp]);

  const query = useMemo(
    () => getAvailableRoutesQuery(selectionMode, counterpartToken),
    [counterpartToken, selectionMode],
  );

  const result = useQuery({
    queryKey: getAvailableRoutesQueryKey(selectionMode, query),
    queryFn: () => {
      if (!query) throw new Error('available routes query is not ready');
      return routerClient.availableRoutes(query);
    },
    enabled: enabled && !!query,
    staleTime: AVAILABLE_ROUTES_STALE_TIME,
  });

  const tokens = useMemo<UiToken[]>(() => {
    if (!result.data) return [];
    const out: UiToken[] = [];
    for (const t of result.data.tokens) {
      if (t.decimals == null) continue;
      const chainName = chainIdToName.get(t.chainId);
      if (!chainName) continue;
      out.push(tokenDiscoveryToUi(t, chainName));
    }
    return out;
  }, [result.data, chainIdToName]);

  useEffect(() => {
    if (tokens.length) syncTokens(tokens);
  }, [tokens, syncTokens]);

  return {
    data: tokens,
    isLoading: chainsLoading || result.isLoading,
    error: result.error,
    isFetched: result.isFetched,
  };
}

export function isBridgeOnlyToken(token: UiToken | undefined): token is UiToken {
  if (!token) return false;
  return (token.canBridge || token.isBridgeToken) && !token.canSwap;
}

export function getAvailableRoutesQueryKey(
  selectionMode: TokenSelectionMode,
  query: ReturnType<typeof getAvailableRoutesQuery>,
) {
  return ['router', 'available-routes', selectionMode, query] as const;
}

export function getAvailableRoutesQuery(
  selectionMode: TokenSelectionMode,
  counterpartToken?: UiToken,
) {
  if (!counterpartToken) return undefined;
  return selectionMode === 'destination'
    ? {
        srcChain: counterpartToken.chainId,
        srcToken: counterpartToken.address,
      }
    : {
        dstChain: counterpartToken.chainId,
        dstToken: counterpartToken.address,
      };
}

// Bootstrap the featured token list. Returns nothing useful directly —
// populates store.knownTokens via the useTokens side-effect. Mount once
// from useEngineBootstrap.
export function useBootstrapTokens(): void {
  useTokens({});
}

export function useTokenByKeyMap(): Map<string, UiToken> {
  return useStore((s) => s.knownTokens);
}

export function getTokenByKeyFromMap(
  map: Map<string, UiToken>,
  key: string | undefined,
): UiToken | undefined {
  if (!key) return undefined;
  return map.get(key);
}
