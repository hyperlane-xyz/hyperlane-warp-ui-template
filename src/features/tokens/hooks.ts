import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useChains } from '../api/hooks';
import { routerClient } from '../api/RouterClient';
import type { TokensQuery } from '../api/types';
import { useStore } from '../store';
import { tokenDiscoveryToUi, type TokenSelectionMode, type UiToken } from './types';

const STALE_5_MIN = 5 * 60 * 1000;
// Available-route discovery powers picker hints and origin prefill; keep it
// warm long enough to avoid repeat calls while quote/submit validation remains
// the source of truth.
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

<<<<<<< HEAD
export function getIndexForToken(warpCore: WarpCore, token?: IToken): number | undefined {
  if (!token) return undefined;
  const index = warpCore.tokens.indexOf(token as Token);
  if (index >= 0) return index;
  else return undefined;
}

export function tryFindToken(
  warpCore: WarpCore,
  chain: ChainName,
  addressOrDenom?: string,
): IToken | null {
  try {
    return warpCore.findToken(chain, addressOrDenom);
  } catch {
    return null;
  }
}

export function getTokenIndexFromChains(
  warpCore: WarpCore,
  addressOrDenom: string | null,
  origin: string,
  destination: string,
) {
  // find routes
  const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);
  // find provided token addressOrDenom
  const queryToken = tokensWithRoute.find((token) => token.addressOrDenom === addressOrDenom);

  // if found return index
  if (queryToken) return getIndexForToken(warpCore, queryToken);
  // if tokens route has only one route return that index
  else if (tokensWithRoute.length === 1) return getIndexForToken(warpCore, tokensWithRoute[0]);
  // if 0 or more than 1 then return undefined
  return undefined;
}

export function getTokenIndexFromChainsAndSymbol(
  warpCore: WarpCore,
  symbol: string | null,
  origin: string,
  destination: string,
) {
  // find routes
  const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);
  // find provided token addressOrDenom
  const queryToken = tokensWithRoute.find(
    (token) => token.symbol.toLowerCase() === symbol?.toLowerCase(),
  );

  // if found return index
  if (queryToken) return getIndexForToken(warpCore, queryToken);
  // if tokens route has only one route return that index
  else if (tokensWithRoute.length === 1) return getIndexForToken(warpCore, tokensWithRoute[0]);
  // if 0 or more than 1
  return undefined;
}

export function getInitialTokenIndex(
  warpCore: WarpCore,
  symbol: string | null,
  originQuery?: string,
  destinationQuery?: string,
  defaultOriginToken?: Token,
  defaultDestinationChain?: string,
): number | undefined {
  const firstToken = defaultOriginToken || warpCore.tokens[0];
  const connectedToken = firstToken.connections?.[0].token;

  // origin query and destination query is defined
  if (originQuery && destinationQuery)
    return getTokenIndexFromChainsAndSymbol(warpCore, symbol, originQuery, destinationQuery);

  // if none of those are defined, use default values and pass token query
  if (defaultDestinationChain || connectedToken) {
    return getTokenIndexFromChainsAndSymbol(
      warpCore,
      symbol,
      firstToken.chainName,
      defaultDestinationChain || connectedToken?.chainName || '',
    );
  }

  return undefined;
}

export function tryFindTokenConnection(token: Token, chainName: string) {
  const connectedToken = token.connections?.find(
    (connection) => connection.token.chainName === chainName,
  );

  return connectedToken ? connectedToken.token : null;
}

export function useAddToken(token?: IToken) {
  const multiProvider = useMultiProvider();
  const activeChains = useActiveChains(multiProvider);
  const watchAsset = useWatchAsset(multiProvider);
  const account = useAccountForChain(multiProvider, token?.chainName);
  const isAccountReady = account?.isReady;
  const isSupportedProtocol = token
    ? ADD_ASSET_SUPPORTED_PROTOCOLS.includes(token?.protocol)
    : false;

  const canAddAsset = token && isAccountReady && isSupportedProtocol;

  const { isPending, mutateAsync } = useMutation({
    mutationFn: () => {
      if (!canAddAsset)
        throw new Error('Cannot import this asset, please check the token imported');

      const { addAsset } = watchAsset[token.protocol];
      const activeChain = activeChains.chains[token.protocol];

      if (!activeChain.chainName)
        throw new Error('Not active chain found, please check if your wallet is connected ');

      return addAsset(token, activeChain.chainName);
    },
=======
  const result = useQuery({
    queryKey: ['router', 'tokens', canonical],
    queryFn: ({ signal }) => routerClient.tokens(canonical, { signal }),
    staleTime: canonical.search ? STALE_30_SEC : STALE_5_MIN,
>>>>>>> origin/main
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
    queryFn: ({ signal }) => {
      if (!query) throw new Error('available routes query is not ready');
      return routerClient.availableRoutes(query, { signal });
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
