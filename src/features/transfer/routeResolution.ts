import { IToken, Token, TokenConnection, WarpCore } from '@hyperlane-xyz/sdk';
import { eqAddress, normalizeAddress } from '@hyperlane-xyz/utils';

export interface ResolvedTransferRoute {
  originToken: Token;
  destinationToken: Token;
}

export interface ResolveTransferRouteParams {
  warpCore: WarpCore;
  originToken: Token;
  destinationToken: IToken;
  allowDestinationCollateralFallback?: boolean;
}

function normalizeMaybeAddress(token: IToken, addressOrDenom?: string): string | null {
  if (!addressOrDenom) return null;
  return normalizeAddress(addressOrDenom, token.protocol);
}

function hasSameDestinationCollateral(tokenA: IToken, tokenB: IToken): boolean {
  const collateralA = normalizeMaybeAddress(tokenA, tokenA.collateralAddressOrDenom);
  const collateralB = normalizeMaybeAddress(tokenB, tokenB.collateralAddressOrDenom);

  if (collateralA && collateralB) {
    return eqAddress(collateralA, collateralB);
  }

  if (tokenA.isHypNative() && tokenB.isHypNative()) {
    return true;
  }

  return false;
}

function hasSameOriginAsset(routeToken: IToken, originToken: IToken): boolean {
  if (routeToken.chainName !== originToken.chainName) return false;

  if (eqAddress(routeToken.addressOrDenom, originToken.addressOrDenom)) {
    return true;
  }

  const routeCollateral = normalizeMaybeAddress(routeToken, routeToken.collateralAddressOrDenom);
  const originCollateral = normalizeMaybeAddress(
    originToken,
    originToken.collateralAddressOrDenom,
  );

  if (routeCollateral && originCollateral) {
    return eqAddress(routeCollateral, originCollateral);
  }

  if (routeToken.isHypNative() && originToken.isHypNative()) {
    return true;
  }

  return routeToken.symbol === originToken.symbol;
}

export function matchesDestinationToken(
  routeDestinationToken: IToken,
  destinationToken: IToken,
  allowCollateralFallback = false,
): boolean {
  if (routeDestinationToken.chainName !== destinationToken.chainName) {
    return false;
  }

  if (eqAddress(routeDestinationToken.addressOrDenom, destinationToken.addressOrDenom)) {
    return true;
  }

  if (!allowCollateralFallback) {
    return false;
  }

  return hasSameDestinationCollateral(routeDestinationToken, destinationToken);
}

export function findConnectionToDestinationToken(
  originToken: IToken,
  destinationToken: IToken,
  allowCollateralFallback = false,
): TokenConnection | undefined {
  const connections = originToken.connections || [];

  const exactConnection = connections.find((connection) =>
    matchesDestinationToken(connection.token, destinationToken),
  );
  if (exactConnection) return exactConnection;

  if (!allowCollateralFallback) return undefined;

  return connections.find((connection) =>
    matchesDestinationToken(connection.token, destinationToken, true),
  );
}

export function resolveTransferRoute({
  warpCore,
  originToken,
  destinationToken,
  allowDestinationCollateralFallback = false,
}: ResolveTransferRouteParams): ResolvedTransferRoute | undefined {
  const directConnection = findConnectionToDestinationToken(
    originToken,
    destinationToken,
    allowDestinationCollateralFallback,
  );
  if (directConnection) {
    return { originToken, destinationToken: directConnection.token as Token };
  }

  const routeTokens = warpCore.getTokensForRoute(originToken.chainName, destinationToken.chainName);
  for (const routeToken of routeTokens) {
    if (!hasSameOriginAsset(routeToken, originToken)) continue;

    const connection = findConnectionToDestinationToken(
      routeToken,
      destinationToken,
      allowDestinationCollateralFallback,
    );
    if (!connection) continue;

    return {
      originToken: routeToken,
      destinationToken: connection.token as Token,
    };
  }

  return undefined;
}
