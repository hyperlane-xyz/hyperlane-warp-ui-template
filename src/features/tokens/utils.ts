<<<<<<< HEAD
import {
  IToken,
  MultiProtocolProvider,
  Token,
  TOKEN_COLLATERALIZED_STANDARDS,
  WarpCore,
} from '@hyperlane-xyz/sdk';
import { eqAddress, isNullish, normalizeAddress } from '@hyperlane-xyz/utils';
import { isChainDisabled } from '../chains/utils';
import { MultiCollateralTokenMap, TokenChainMap, Tokens } from './types';
=======
import type { UiToken } from './types';
>>>>>>> origin/main

export type TokenRouteKind = 'bridge' | 'swap';

export function getTokenKey(token: UiToken): string {
  return tokenKey(token.chainId, token.address);
}

<<<<<<< HEAD
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
=======
export function tokenKey(chainId: number, address: string): string {
  const normalizedAddress = /^0x[a-fA-F0-9]{40}$/.test(address) ? address.toLowerCase() : address;
  return `${chainId}-${normalizedAddress}`;
}

export function mergeRouteTokensFirst(routeTokens: UiToken[], tokens: UiToken[]): UiToken[] {
  if (!routeTokens.length) return tokens;
  const seen = new Set<string>();
  const out: UiToken[] = [];
  for (const token of [...routeTokens, ...tokens]) {
    const key = getTokenKey(token);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
>>>>>>> origin/main
}

export function getTokenRouteKind(
  token: UiToken,
  directRouteTokenKeys: Set<string>,
  counterpartToken?: UiToken,
): TokenRouteKind | undefined {
  if (directRouteTokenKeys.has(getTokenKey(token))) return 'bridge';
  if (token.canSwap && counterpartToken?.canSwap) return 'swap';
  return undefined;
}

<<<<<<< HEAD
      const destinationToken = originToken.getConnectionForChain(destination)!.token;

      // For HypNative tokens, use their symbol and standard as identifier since they don't have collateralAddressOrDenom
      const originAddress = originToken.collateralAddressOrDenom
        ? normalizeAddress(originToken.collateralAddressOrDenom, originToken.protocol)
        : `hypnative-${originToken.standard}-${originToken.symbol}`;

      const destinationAddress = destinationToken.collateralAddressOrDenom
        ? normalizeAddress(destinationToken.collateralAddressOrDenom, destinationToken.protocol)
        : `hypnative-${destinationToken.standard}-${destinationToken.symbol}`;
=======
export function getRoutePrefillToken(
  routeTokens: UiToken[],
  currentToken?: UiToken,
): UiToken | undefined {
  if (!routeTokens.length) return undefined;
  if (!currentToken) return routeTokens[0];
>>>>>>> origin/main

  const currentKey = getTokenKey(currentToken);
  // Origin changes prefer a direct bridge destination over preserving a
  // swap-only destination, so the user lands on the safest known route.
  return routeTokens.some((token) => getTokenKey(token) === currentKey)
    ? undefined
    : routeTokens[0];
}
