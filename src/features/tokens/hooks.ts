import { IToken, Token, WarpCore } from '@hyperlane-xyz/sdk';
import { normalizeAddress } from '@hyperlane-xyz/utils';
import { useAccountForChain, useActiveChains, useWatchAsset } from '@hyperlane-xyz/widgets';
import { useMutation } from '@tanstack/react-query';
import { ADD_ASSET_SUPPORTED_PROTOCOLS } from '../../consts/args';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';

export function useWarpCore() {
  return useStore((s) => s.warpCore);
}

// ============================================
// Token Key System
// ============================================
// Format: "chainName-symbol-addressOrDenom" (stable identifier)
// Example: "ethereum-usdc-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"

/**
 * Generate a stable token key from a token object
 * Uses chainName + lowercase symbol + normalized address
 */
export function getTokenKey(token: IToken): string {
  const normalizedAddress = normalizeAddress(token.addressOrDenom, token.protocol);
  return `${token.chainName}-${token.symbol.toLowerCase()}-${normalizedAddress}`;
}

/**
 * Find a token by its key
 */
export function getTokenByKey(warpCore: WarpCore, key: string | undefined): Token | undefined {
  if (!key) return undefined;
  return warpCore.tokens.find((token) => getTokenKey(token) === key);
}

/**
 * Hook to get a token by its key
 */
export function useTokenByKey(key: string | undefined): Token | undefined {
  const warpCore = useWarpCore();
  return getTokenByKey(warpCore, key);
}

/**
 * Hook to get a token key for a token
 */
export function useTokenKey(token: IToken | undefined): string | undefined {
  if (!token) return undefined;
  return getTokenKey(token);
}

/**
 * Get token key from origin/destination chains (for route lookup)
 * Returns the key of a token that has a route between origin and destination
 * Can match by addressOrDenom and/or symbol (both checks are useful because
 * some routes may have same addressOrDenom but different symbol)
 */
export function getTokenKeyFromChains(
  warpCore: WarpCore,
  addressOrDenom: string | null,
  origin: string,
  destination: string,
  symbol?: string | null,
): string | undefined {
  const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);

  // Find by both address and symbol if both provided
  if (addressOrDenom && symbol) {
    const queryToken = tokensWithRoute.find(
      (token) =>
        token.addressOrDenom === addressOrDenom &&
        token.symbol.toLowerCase() === symbol.toLowerCase(),
    );
    if (queryToken) return getTokenKey(queryToken);
  }

  // Find by address if provided
  if (addressOrDenom) {
    const queryToken = tokensWithRoute.find((token) => token.addressOrDenom === addressOrDenom);
    if (queryToken) return getTokenKey(queryToken);
  }

  // Find by symbol if provided
  if (symbol) {
    const queryToken = tokensWithRoute.find(
      (token) => token.symbol.toLowerCase() === symbol.toLowerCase(),
    );
    if (queryToken) return getTokenKey(queryToken);
  }

  // If only one route, return that token's key
  if (tokensWithRoute.length === 1) return getTokenKey(tokensWithRoute[0]);

  return undefined;
}

/**
 * Get token key from chains and symbol (for URL params)
 */
export function getTokenKeyFromChainsAndSymbol(
  warpCore: WarpCore,
  symbol: string | null,
  origin: string,
  destination: string,
): string | undefined {
  const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);

  const queryToken = symbol
    ? tokensWithRoute.find((token) => token.symbol.toLowerCase() === symbol.toLowerCase())
    : undefined;

  if (queryToken) return getTokenKey(queryToken);
  if (tokensWithRoute.length === 1) return getTokenKey(tokensWithRoute[0]);

  return undefined;
}

/**
 * Get initial token key (for app initialization from URL params)
 */
export function getInitialTokenKey(
  warpCore: WarpCore,
  symbol: string | null,
  originQuery?: string,
  destinationQuery?: string,
  defaultOriginToken?: Token,
  defaultDestinationChain?: string,
): string | undefined {
  const firstToken = defaultOriginToken || warpCore.tokens[0];
  const connectedToken = firstToken?.connections?.[0]?.token;

  // If origin and destination query are defined, use them
  if (originQuery && destinationQuery) {
    return getTokenKeyFromChainsAndSymbol(warpCore, symbol, originQuery, destinationQuery);
  }

  // Use default values
  if (defaultDestinationChain || connectedToken) {
    return getTokenKeyFromChainsAndSymbol(
      warpCore,
      symbol,
      firstToken?.chainName || '',
      defaultDestinationChain || connectedToken?.chainName || '',
    );
  }

  return undefined;
}

export function useTokens() {
  return useWarpCore().tokens;
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
