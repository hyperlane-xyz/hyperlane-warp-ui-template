import {
  ChainName,
  IToken,
  MultiProtocolProvider,
  Token,
  TOKEN_COLLATERALIZED_STANDARDS,
  WarpCore,
} from '@hyperlane-xyz/sdk';
import { eqAddress, isNullish, normalizeAddress } from '@hyperlane-xyz/utils';
import { isChainDisabled } from '../chains/utils';
import { MultiCollateralTokenMap, TokenChainMap, Tokens } from './types';

// Map of token symbols and token chain map
// Symbols are not duplicated to avoid the same symbol from being shown
// TokenChainMap: An object containing token information and a map
// chain names with its metadata and the related token
export function assembleTokensBySymbolChainMap(
  tokens: Token[],
  multiProvider: MultiProtocolProvider,
): Record<string, TokenChainMap> {
  const multiChainTokens = tokens.filter((t) => t.isMultiChainToken());
  return multiChainTokens.reduce<Record<string, TokenChainMap>>((acc, token) => {
    if (!token.connections || !token.connections.length) return acc;

    if (!acc[token.symbol]) {
      acc[token.symbol] = {
        chains: {},
        tokenInformation: token,
      };
    }
    if (!acc[token.symbol].chains[token.chainName]) {
      const chainMetadata = multiProvider.tryGetChainMetadata(token.chainName);

      // remove chain from map if it is disabled
      const chainDisabled = isChainDisabled(chainMetadata);
      if (chainDisabled) return acc;

      acc[token.symbol].chains[token.chainName] = { token, metadata: chainMetadata };
    }

    return acc;
  }, {});
}

export function isValidMultiCollateralToken(
  originToken: Token | IToken,
  destination: ChainName | IToken,
) {
  // HypNative tokens are Collaterized but does not contain collateralAddressOrDenom (most of the time)
  if (
    (!originToken.collateralAddressOrDenom && !originToken.isHypNative()) ||
    !TOKEN_COLLATERALIZED_STANDARDS.includes(originToken.standard)
  )
    return false;

  const destinationToken =
    typeof destination === 'string'
      ? originToken.getConnectionForChain(destination)?.token
      : destination;

  // Check if destination is collateralized - has collateral address, is HypNative, or is in SDK's list
  // Note: Some standards like EvmHypCollateralFiat may not be in TOKEN_COLLATERALIZED_STANDARDS
  const isDestCollateralized =
    !!destinationToken?.collateralAddressOrDenom ||
    destinationToken?.isHypNative?.() ||
    TOKEN_COLLATERALIZED_STANDARDS.includes(destinationToken?.standard as any);

  if (!destinationToken || !isDestCollateralized) return false;

  return true;
}

export function getTokensWithSameCollateralAddresses(
  warpCore: WarpCore,
  origin: Token,
  destination: IToken,
) {
  if (
    !TOKEN_COLLATERALIZED_STANDARDS.includes(origin.standard) ||
    !TOKEN_COLLATERALIZED_STANDARDS.includes(destination.standard)
  )
    return [];

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
      const destinationToken = originToken.getConnectionForChain(destination.chainName)?.token;
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

      // For HypNative tokens if both addresses are null then it matches, otherwise check with eqAddress
      const originMatches =
        isNullish(originCollateralAddress) && isNullish(currentOriginCollateralAddress)
          ? true
          : originCollateralAddress && currentOriginCollateralAddress
            ? eqAddress(originCollateralAddress, currentOriginCollateralAddress)
            : false;

      const destinationMatches =
        isNullish(destinationCollateralAddress) && isNullish(currentDestinationCollateralAddress)
          ? true
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
 */
export function getTokenKey(token: IToken): string {
  const normalizedAddress = normalizeAddress(token.addressOrDenom, token.protocol);
  return `${token.chainName.toLowerCase()}-${token.symbol.toLowerCase()}-${normalizedAddress}`;
}

// De-duplicate collaterized tokens
// Returns a map of token with same origin and dest collateral address
// And an array of tokens with repeated collateral addresses grouped into one
export function dedupeMultiCollateralTokens(tokens: Tokens, destination: ChainName) {
  return tokens.reduce<{ tokens: Tokens; multiCollateralTokenMap: MultiCollateralTokenMap }>(
    (acc, t) => {
      const originToken = t.token;
      const isMultiCollateralToken = isValidMultiCollateralToken(originToken, destination);
      if (!isMultiCollateralToken) return { ...acc, tokens: [...acc.tokens, t] };

      const destinationToken = originToken.getConnectionForChain(destination)!.token;

      // For HypNative tokens, use their symbol and standard as identifier since they don't have collateralAddressOrDenom
      const originAddress = originToken.collateralAddressOrDenom
        ? normalizeAddress(originToken.collateralAddressOrDenom, originToken.protocol)
        : `hypnative-${originToken.standard}-${originToken.symbol}`;

      const destinationAddress = destinationToken.collateralAddressOrDenom
        ? normalizeAddress(destinationToken.collateralAddressOrDenom, destinationToken.protocol)
        : `hypnative-${destinationToken.standard}-${destinationToken.symbol}`;

      // now origin and destination are both collaterals
      // create map for tokens with same origin and destination collateral addresses
      acc.multiCollateralTokenMap[originAddress] ||= {};
      if (!acc.multiCollateralTokenMap[originAddress][destinationAddress]) {
        acc.multiCollateralTokenMap[originAddress][destinationAddress] = [];
        acc.tokens.push(t);
      }

      acc.multiCollateralTokenMap[originAddress][destinationAddress].push(originToken);
      return acc;
    },
    { tokens: [], multiCollateralTokenMap: {} },
  );
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
    if (!TOKEN_COLLATERALIZED_STANDARDS.includes(token.standard)) {
      return true;
    }

    const chainName = token.chainName.toLowerCase();
    const symbol = token.symbol.toLowerCase();
    const protocol = token.protocol;
    // For HypNative tokens, use their symbol and protocol as identifier
    const collateralKey = token.collateralAddressOrDenom
      ? `${chainName}-${symbol}-${normalizeAddress(token.collateralAddressOrDenom, protocol)}`
      : `${chainName}-${symbol}-hypnative-${protocol}`;

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
export function buildCollateralGroups(tokens: Token[]): Map<string, Token[]> {
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
 */
export function getCollateralKey(token: IToken): string {
  const chainName = token.chainName.toLowerCase();
  const symbol = token.symbol.toLowerCase();
  const protocol = token.protocol;

  // For collateralized tokens, use the collateral address
  if (TOKEN_COLLATERALIZED_STANDARDS.includes(token.standard)) {
    if (token.collateralAddressOrDenom) {
      return `${chainName}-${symbol}-${normalizeAddress(token.collateralAddressOrDenom, protocol)}`;
    }
    // For HypNative tokens without collateralAddressOrDenom
    return `${chainName}-${symbol}-hypnative-${protocol}`;
  }

  // For non-collateralized tokens, use the token's own address
  return `${chainName}-${symbol}-${normalizeAddress(token.addressOrDenom, protocol)}`;
}

/**
 * Check if two tokens share the same collateral
 */
export function sharesCollateral(tokenA: IToken, tokenB: IToken): boolean {
  return getCollateralKey(tokenA) === getCollateralKey(tokenB);
}

/**
 * Check if a displayed origin token can reach a specific destination token
 * This accounts for collateral deduplication by:
 * 1. Finding all tokens that share collateral with the displayed origin
 * 2. Checking if any of their connections share collateral with the destination token
 */
export function originTokenCanReachDestinationToken(
  warpCore: WarpCore,
  displayedOriginToken: IToken,
  selectedDestinationToken: IToken,
): boolean {
  // Get all tokens from origin's chain that could be the "real" token behind the displayed one
  const originChainTokens = warpCore.getTokensForChain(displayedOriginToken.chainName);

  // Find all origin tokens that share collateral with the displayed origin token
  const originCollateralGroup = originChainTokens.filter((t) =>
    sharesCollateral(t, displayedOriginToken),
  );

  // Check if any token in the origin's collateral group can reach a token
  // that shares collateral with the destination
  return originCollateralGroup.some((originToken) => {
    const destConnection = originToken.getConnectionForChain(selectedDestinationToken.chainName);
    if (!destConnection?.token) return false;
    return sharesCollateral(destConnection.token, selectedDestinationToken);
  });
}

/**
 * Check if a displayed destination token can be reached from a specific origin token
 * This accounts for collateral deduplication by:
 * 1. Finding all tokens that share collateral with the selected origin
 * 2. Checking if any of their connections share collateral with the displayed destination token
 */
export function destinationTokenCanBeReachedFromOriginToken(
  warpCore: WarpCore,
  displayedDestinationToken: IToken,
  selectedOriginToken: IToken,
): boolean {
  // Get all tokens from origin's chain that could be the "real" token behind the selected one
  const originChainTokens = warpCore.getTokensForChain(selectedOriginToken.chainName);

  // Find all origin tokens that share collateral with the selected origin token
  const originCollateralGroup = originChainTokens.filter((t) =>
    sharesCollateral(t, selectedOriginToken),
  );

  // Check if any token in the origin's collateral group can reach a token
  // that shares collateral with the displayed destination
  return originCollateralGroup.some((originToken) => {
    const destConnection = originToken.getConnectionForChain(displayedDestinationToken.chainName);
    if (!destConnection?.token) return false;
    return sharesCollateral(destConnection.token, displayedDestinationToken);
  });
}
