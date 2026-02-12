import { IToken, Token, WarpCore } from '@hyperlane-xyz/sdk';
import { useAccountForChain, useActiveChains, useWatchAsset } from '@hyperlane-xyz/widgets';
import { useMutation } from '@tanstack/react-query';
import { ADD_ASSET_SUPPORTED_PROTOCOLS, WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { getQueryParams } from '../../utils/queryParams';
import { useMultiProvider } from '../chains/hooks';
import { tryGetValidChainName } from '../chains/utils';
import { useStore } from '../store';
import { getSwappableAddress, isDemoSwapBridgePath, isSwapSupported } from '../swap/swapConfig';
import { getTokenKey } from './utils';

export function useWarpCore() {
  return useStore((s) => s.warpCore);
}
/**
 * Find a token by its key from a WarpCore or Token array
 */
export function getTokenByKey(tokens: Token[], key: string | undefined): Token | undefined {
  if (!key) return undefined;
  return tokens.find((token) => getTokenKey(token) === key);
}

// Helper to find token by chainName-symbol format
function findTokenByChainSymbol(tokens: Token[], chainSymbol: string): Token | undefined {
  const [chainName, symbol] = chainSymbol.split('-');
  if (!chainName || !symbol) return undefined;
  return tokens.find(
    (t) => t.chainName === chainName && t.symbol.toLowerCase() === symbol.toLowerCase(),
  );
}

function findTokensByChainSymbol(tokens: Token[], chainName: string, symbol: string): Token[] {
  return tokens.filter(
    (t) => t.chainName === chainName && t.symbol.toLowerCase() === symbol.toLowerCase(),
  );
}

/**
 * Get initial origin and destination token keys from URL params
 * Returns { originTokenKey, destinationTokenKey } for form initialization
 */
export function getInitialTokenKeys(
  warpCore: WarpCore,
  tokens: Token[],
): { originTokenKey: string | undefined; destinationTokenKey: string | undefined } {
  // Early return if no tokens
  if (tokens.length === 0) {
    return { originTokenKey: undefined, destinationTokenKey: undefined };
  }

  // 1. First priority: URL params
  const params = getQueryParams();
  const originChainQuery = tryGetValidChainName(
    params.get(WARP_QUERY_PARAMS.ORIGIN),
    warpCore.multiProvider,
  );
  const destinationChainQuery = tryGetValidChainName(
    params.get(WARP_QUERY_PARAMS.DESTINATION),
    warpCore.multiProvider,
  );
  const originTokenSymbol = params.get(WARP_QUERY_PARAMS.ORIGIN_TOKEN);
  const destinationTokenSymbol = params.get(WARP_QUERY_PARAMS.DESTINATION_TOKEN);

  // Try to find origin token from URL params (chain + symbol)
  let originToken: Token | undefined;
  if (originChainQuery && originTokenSymbol) {
    const candidates = findTokensByChainSymbol(tokens, originChainQuery, originTokenSymbol);
    originToken =
      candidates.find((t) => t.isNative() || t.isHypNative()) || candidates[0] || undefined;
  }

  // 2. Second priority: Config default token (format: chainName-symbol)
  if (!originToken && config.defaultOriginToken) {
    originToken = findTokenByChainSymbol(tokens, config.defaultOriginToken);
  }

  // 3. Last resort: First available token with connections (can be origin)
  if (!originToken) {
    originToken = tokens.find((t) => t.connections && t.connections.length > 0);
  }

  // Try to find destination token from URL params (chain + symbol)
  let destinationToken: Token | undefined;
  if (destinationChainQuery && destinationTokenSymbol) {
    const candidates = findTokensByChainSymbol(
      tokens,
      destinationChainQuery,
      destinationTokenSymbol,
    );
    const routeOriginChain = originToken?.chainName || originChainQuery;
    const demoCandidate =
      routeOriginChain && isSwapSupported(routeOriginChain, destinationChainQuery)
        ? candidates.find((token) =>
            isDemoSwapBridgePath({
              originChainName: routeOriginChain,
              destinationChainName: destinationChainQuery,
              destinationTokenAddress: getSwappableAddress(token) ?? token.addressOrDenom,
              destinationRouteAddress: token.addressOrDenom,
            }),
          )
        : undefined;
    destinationToken = demoCandidate || candidates[0] || undefined;
  }

  // Fallback: use config default token (format: chainName-symbol)
  if (!destinationToken && config.defaultDestinationToken) {
    destinationToken = findTokenByChainSymbol(tokens, config.defaultDestinationToken);
  }

  // Last resort: first connection from origin token
  if (!destinationToken && originToken) {
    const firstConnection = originToken.connections?.[0];
    const connectedChain = firstConnection?.token?.chainName;
    const connectedSymbol = firstConnection?.token?.symbol;
    destinationToken = connectedChain
      ? tokens.find((t) => t.chainName === connectedChain && t.symbol === connectedSymbol)
      : undefined;
  }

  return {
    originTokenKey: originToken ? getTokenKey(originToken) : undefined,
    destinationTokenKey: destinationToken ? getTokenKey(destinationToken) : undefined,
  };
}

/** Raw tokens from WarpCore (not deduplicated) */
export function useWarpCoreTokens() {
  return useWarpCore().tokens;
}

/** Unified tokens array (deduplicated, can be origin or destination) */
export function useTokens() {
  return useStore((s) => s.tokens);
}

export function useCollateralGroups() {
  return useStore((s) => s.collateralGroups);
}

/** Pre-computed token key to Token map for O(1) lookups */
export function useTokenByKeyMap() {
  return useStore((s) => s.tokenByKeyMap);
}

/**
 * O(1) token lookup by key using the pre-computed map.
 * Use this instead of getTokenByKey() for better performance.
 */
export function getTokenByKeyFromMap(
  tokenByKeyMap: Map<string, Token>,
  key: string | undefined,
): Token | undefined {
  if (!key) return undefined;
  return tokenByKeyMap.get(key);
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
  });

  return { addToken: mutateAsync, isLoading: isPending, canAddAsset };
}
