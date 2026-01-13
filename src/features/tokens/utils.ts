import {
  IToken,
  MultiProtocolProvider,
  Token,
  TOKEN_COLLATERALIZED_STANDARDS,
  WarpCore,
} from '@hyperlane-xyz/sdk';
<<<<<<< HEAD
import { eqAddress, isNullish, normalizeAddress } from '@hyperlane-xyz/utils';
import { isChainDisabled } from '../chains/utils';
import { MultiCollateralTokenMap, TokenChainMap, Tokens } from './types';
=======
import { eqAddress, isNullish, normalizeAddress, objKeys } from '@hyperlane-xyz/utils';
import { isChainDisabled } from '../chains/utils';
import {
  DefaultMultiCollateralRoutes,
  MultiCollateralTokenMap,
  TokenChainMap,
  Tokens,
} from './types';
>>>>>>> origin/main

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

  if (
    !destinationToken ||
    (!destinationToken.collateralAddressOrDenom && !destinationToken.isHypNative()) ||
    !TOKEN_COLLATERALIZED_STANDARDS.includes(destinationToken.standard)
  )
    return false;

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

// De-duplicate collaterized tokens
// Returns a map of token with same origin and dest collateral address
// And an array of tokens with repeated collateral addresses grouped into one
export function dedupeMultiCollateralTokens(tokens: Tokens, destination) {
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
<<<<<<< HEAD
=======

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
>>>>>>> origin/main
