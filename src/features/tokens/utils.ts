import {
  IToken,
  Token,
  TOKEN_COLLATERALIZED_STANDARDS,
  TokenStandard,
  WarpCore,
} from '@hyperlane-xyz/sdk';
import { eqAddress, isNullish, normalizeAddress, objKeys } from '@hyperlane-xyz/utils';

import { DefaultMultiCollateralRoutes } from './types';

// Module-level caches for expensive key computations
// WeakMap allows automatic garbage collection when token objects are no longer referenced
const tokenKeyCache = new WeakMap<IToken, string>();
let collateralKeyCache = new WeakMap<IToken, string>();

// Resolved underlying addresses for lockbox/vault tokens.
// Set once during initWarpContext via setResolvedUnderlyingMap().
// getCollateralKey() uses this to group lockbox/vault tokens with their
// non-wrapper counterparts (e.g., lockbox USDT grouped with regular USDT).
let resolvedUnderlyingMap: Map<string, string> = new Map();
const EXTRA_COLLATERALIZED_STANDARDS = new Set([TokenStandard.EvmHypCollateralFiat]);

/**
 * Set the resolved underlying address map for lockbox/vault tokens.
 * Must be called before buildTokensArray/groupTokensByCollateral.
 * Clears the collateral key cache since keys may change.
 */
export function setResolvedUnderlyingMap(map: Map<string, string>) {
  resolvedUnderlyingMap = map;
  collateralKeyCache = new WeakMap();
}

function isCollateralizedToken(token: IToken): boolean {
  return (
    TOKEN_COLLATERALIZED_STANDARDS.includes(token.standard) ||
    EXTRA_COLLATERALIZED_STANDARDS.has(token.standard) ||
    token.isHypNative()
  );
}

export function isValidMultiCollateralToken(
  originToken: Token | IToken,
  destinationToken: Token | IToken,
) {
  if (!isCollateralizedToken(originToken)) return false;
  if (!isCollateralizedToken(destinationToken)) return false;
  return true;
}

/**
 * Resolve the connected destination token from originToken that matches the selected destination token.
 * For multi-collateral routes, there can be multiple connections for the same destination chain.
 * In that case we prioritize collateral-key matching, then address matching.
 */
export function findConnectedDestinationToken(
  originToken: Token | IToken,
  destinationToken: Token | IToken,
): Token | undefined {
  const destinationCandidates = originToken
    .getConnections()
    .filter((connection) => connection.token.chainName === destinationToken.chainName)
    .map((connection) => connection.token as Token);

  if (!destinationCandidates.length) return undefined;

  const destinationCollateralKey = getCollateralKey(destinationToken);
  return (
    destinationCandidates.find(
      (candidate) => getCollateralKey(candidate) === destinationCollateralKey,
    ) ||
    destinationCandidates.find((candidate) =>
      eqAddress(candidate.addressOrDenom, destinationToken.addressOrDenom),
    )
  );
}

export function getTokensWithSameCollateralAddresses(
  warpCore: WarpCore,
  origin: Token,
  destination: IToken,
) {
  if (!isCollateralizedToken(origin) || !isCollateralizedToken(destination)) return [];

  // For HypNative tokens, use null as identifier since they don't have collateralAddressOrDenom
  const originCollateralAddress = origin.collateralAddressOrDenom
    ? normalizeAddress(origin.collateralAddressOrDenom, origin.protocol)
    : null;
  const destinationCollateralAddress = destination.collateralAddressOrDenom
    ? normalizeAddress(destination.collateralAddressOrDenom, destination.protocol)
    : null;

  return warpCore
    .getTokensForRoute(origin.chainName, destination.chainName)
    .map((originToken) => {
      const destinationToken = findConnectedDestinationToken(originToken, destination);
      return { originToken, destinationToken };
    })
    .filter((tokens): tokens is { originToken: Token; destinationToken: Token } => {
      // doing this because annoying Typescript will have destinationToken
      // as undefined even if it is filtered out
      const { originToken, destinationToken } = tokens;

      if (!destinationToken) return false;
      const isMultiCollateralToken = isValidMultiCollateralToken(originToken, destinationToken);
      if (!isMultiCollateralToken) return false;

      const currentOriginCollateralAddress = originToken.collateralAddressOrDenom
        ? normalizeAddress(originToken.collateralAddressOrDenom, originToken.protocol)
        : null;
      const currentDestinationCollateralAddress = destinationToken.collateralAddressOrDenom
        ? normalizeAddress(destinationToken.collateralAddressOrDenom, destinationToken.protocol)
        : null;

      // For HypNative tokens both collateral addresses are null — match by symbol
      // to avoid treating different native deployments (e.g. ETH vs ETHSTAGE) as interchangeable
      const originMatches =
        isNullish(originCollateralAddress) && isNullish(currentOriginCollateralAddress)
          ? originToken.symbol === origin.symbol
          : originCollateralAddress && currentOriginCollateralAddress
            ? eqAddress(originCollateralAddress, currentOriginCollateralAddress)
            : false;

      const destinationMatches =
        isNullish(destinationCollateralAddress) && isNullish(currentDestinationCollateralAddress)
          ? destinationToken.symbol === destination.symbol
          : destinationCollateralAddress && currentDestinationCollateralAddress
            ? eqAddress(destinationCollateralAddress, currentDestinationCollateralAddress)
            : false;

      return originMatches && destinationMatches;
    });
}

/**
 * Generate a stable token key from a token object
 * Uses chainName + lowercase symbol + normalized address
 * Format: "chainName-symbol-addressOrDenom" (stable identifier)
 * Example: "ethereum-usdc-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
 *
 * Results are cached by token object reference for O(1) subsequent lookups.
 */
export function getTokenKey(token: IToken): string {
  const cached = tokenKeyCache.get(token);
  if (!isNullish(cached)) return cached;

  const normalizedAddress = normalizeAddress(token.addressOrDenom, token.protocol);
  const key = `${token.chainName.toLowerCase()}-${token.symbol.toLowerCase()}-${normalizedAddress}`;

  tokenKeyCache.set(token, key);
  return key;
}

/**
 * De-duplicate tokens by collateral address on the same chain
 * Returns only one token per unique collateral address per chain
 * Used for both origin and destination token arrays at startup
 */
export function dedupeTokensByCollateral(tokens: Token[]): Token[] {
  const seenCollaterals = new Map<string, Token>();

  return tokens.filter((token) => {
    // If not a collateralized token, include it
    if (!isCollateralizedToken(token)) {
      return true;
    }

    const collateralKey = getCollateralKey(token);

    // If we haven't seen this collateral on this chain, include it
    if (!seenCollaterals.has(collateralKey)) {
      seenCollaterals.set(collateralKey, token);
      return true;
    }

    // Already seen this collateral, skip it
    return false;
  });
}

/**
 * Build a unified tokens array containing all tokens that can participate in transfers
 * (either as origin or destination). Deduplicates by address and by collateral.
 */
export function buildTokensArray(warpCoreTokens: Token[]): Token[] {
  const tokenMap = new Map<string, Token>();

  // Add all tokens that have connections (can be origins)
  for (const token of warpCoreTokens) {
    if (token.connections && token.connections.length > 0) {
      const key = getTokenKey(token);
      if (!tokenMap.has(key)) {
        tokenMap.set(key, token);
      }
    }
  }

  // Add all destination tokens (reachable via connections)
  for (const token of warpCoreTokens) {
    token.connections?.forEach((conn) => {
      const destToken = conn.token as Token;
      const key = getTokenKey(destToken);
      if (!tokenMap.has(key)) {
        tokenMap.set(key, destToken);
      }
    });
  }

  // Deduplicate tokens that have same collateral address on the same chain
  return dedupeTokensByCollateral(Array.from(tokenMap.values()));
}

/**
 * Build collateral groups - groups tokens by their collateral key for O(1) lookup
 * Used for fast route checking in the token selection modal
 */
export function groupTokensByCollateral(tokens: Token[]): Map<string, Token[]> {
  const groups = new Map<string, Token[]>();
  for (const token of tokens) {
    const key = getCollateralKey(token);
    const existing = groups.get(key) || [];
    existing.push(token);
    groups.set(key, existing);
  }
  return groups;
}

/**
 * Get a unique collateral identifier for a token
 * Used to determine if two tokens share the same underlying collateral
 *
 * For lockbox/vault tokens whose collateralAddressOrDenom points to a wrapper,
 * uses the resolved underlying address (from resolvedUnderlyingMap) so they
 * group with their non-wrapper counterparts.
 *
 * Results are cached by token object reference for O(1) subsequent lookups.
 */
export function getCollateralKey(token: IToken): string {
  const cached = collateralKeyCache.get(token);
  if (!isNullish(cached)) return cached;

  const chainName = token.chainName.toLowerCase();
  const symbol = token.symbol.toLowerCase();
  const protocol = token.protocol;

  let key: string;

  // For collateralized tokens, use the collateral address
  if (isCollateralizedToken(token)) {
    if (token.collateralAddressOrDenom) {
      // Check if this token has a resolved underlying address (lockbox/vault)
      const tokenId = getTokenKey(token);
      const resolvedUnderlying = resolvedUnderlyingMap.get(tokenId);
      const collateralAddress = resolvedUnderlying ?? token.collateralAddressOrDenom;
      key = `${chainName}-${symbol}-${normalizeAddress(collateralAddress, protocol)}`;
    } else {
      // For HypNative tokens without collateralAddressOrDenom
      key = `${chainName}-${symbol}-hypnative-${protocol}`;
    }
  } else {
    // For non-collateralized tokens, use the token's own address
    key = `${chainName}-${symbol}-${normalizeAddress(token.addressOrDenom, protocol)}`;
  }

  collateralKeyCache.set(token, key);
  return key;
}

/**
 * Check if a route exists between origin and destination tokens
 * Uses pre-computed collateral groups for fast O(1) lookups
 *
 * @param originToken - The origin token (what the user is sending)
 * @param destToken - The destination token (what the user will receive)
 * @param collateralGroups - Pre-computed map of collateral key → tokens
 * @returns true if a valid route exists between the tokens
 */
export function checkTokenHasRoute(
  originToken: Token,
  destToken: Token,
  collateralGroups: Map<string, Token[]>,
): boolean {
  const originCollateralKey = getCollateralKey(originToken);
  const originGroup = collateralGroups.get(originCollateralKey) || [];

  // Check if any token in origin's collateral group has a matching connection
  // to the specific destination token. Uses findConnectedDestinationToken to stay
  // consistent with the transfer flow's matching logic (collateral key + address fallback).
  return originGroup.some((token) => Boolean(findConnectedDestinationToken(token, destToken)));
}

/**
 * Find the actual warpCore token that has a route to the destination.
 * The passed originToken may be from a deduplicated array and may not have
 * the connection, but another token with the same collateral in the warpCore might
 * have this token.
 */
export function findRouteToken(
  warpCore: WarpCore,
  originToken: Token,
  destinationToken: IToken,
): Token | undefined {
  const destinationChain = destinationToken.chainName;

  // First check if the passed token already has the right connection.
  // Must verify the connected token matches the intended destination — not just any
  // connection to that chain — because the same origin can connect to different
  // destination tokens on the same chain (e.g. USDC->USDC vs USDC->XO on Solana)
  const existingConnection = findConnectedDestinationToken(originToken, destinationToken);
  if (existingConnection) return originToken;

  // Otherwise, find all the tokens from warpCore that has a route with the origin and destination
  const routeTokens = warpCore.getTokensForRoute(originToken.chainName, destinationChain);
  if (routeTokens.length === 0) return undefined;

  const originCollateralKey = getCollateralKey(originToken);
  const collateralMatches = routeTokens.filter((t) => getCollateralKey(t) === originCollateralKey);

  // When multiple routes share the same origin collateral but connect to different
  // destination tokens (e.g. USDC->USDC vs USDC->XO), use the destination token
  // to pick the correct route
  if (collateralMatches.length > 1) {
    const exactMatch = collateralMatches.find((t) => {
      const connectedToken = findConnectedDestinationToken(t, destinationToken);
      return connectedToken;
    });
    if (exactMatch) return exactMatch;
  }

  return collateralMatches[0];
}

// Returns the default origin token from tokensWithSameCollateralAddresses if:
// - It is a valid multi-collateral token
// - Both origin and destination chains are configured in defaultMultiCollateralRoutes
// - A matching token is found in tokensWithSameCollateralAddresses
// Returns null if no default is found (caller should fall back to fee-based selection)
export function tryGetDefaultOriginToken(
  originToken: IToken,
  destinationToken: IToken,
  defaultMultiCollateralRoutes: DefaultMultiCollateralRoutes | undefined,
  tokensWithSameCollateralAddresses: { originToken: Token; destinationToken: Token }[],
): Token | null {
  // this call might be repeated with getTransferToken but it ensures we are only dealing with valid
  // multi-collateral tokens here
  if (!isValidMultiCollateralToken(originToken, destinationToken)) return null;
  if (!defaultMultiCollateralRoutes) return null;

  const originChainName = originToken.chainName;
  const destChainName = destinationToken.chainName;

  // Check both chains are in config
  if (
    !objKeys(defaultMultiCollateralRoutes).includes(originChainName) ||
    !objKeys(defaultMultiCollateralRoutes).includes(destChainName)
  )
    return null;

  // Get lookup key - 'native' for HypNative, collateralAddressOrDenom otherwise
  const originKey = originToken.isHypNative() ? 'native' : originToken.collateralAddressOrDenom;
  const destKey = destinationToken.isHypNative()
    ? 'native'
    : destinationToken.collateralAddressOrDenom;

  if (!originKey || !destKey) return null;

  const defaultOriginAddressOrDenom = defaultMultiCollateralRoutes[originChainName][originKey];
  const defaultDestAddressOrDenom = defaultMultiCollateralRoutes[destChainName][destKey];

  if (!defaultOriginAddressOrDenom || !defaultDestAddressOrDenom) return null;

  // Find matching token from tokensWithSameCollateralAddresses
  const match = tokensWithSameCollateralAddresses.find(
    ({ originToken: ot, destinationToken: dt }) =>
      eqAddress(ot.addressOrDenom, defaultOriginAddressOrDenom) &&
      eqAddress(dt.addressOrDenom, defaultDestAddressOrDenom),
  );

  return match?.originToken ?? null;
}
