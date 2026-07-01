import type { IRegistry } from '@hyperlane-xyz/registry';
import type { WarpCoreConfig } from '@hyperlane-xyz/sdk';

import { logger } from '../../utils/logger';

type WarpRouteToken = WarpCoreConfig['tokens'][number];

export interface TrustedWarpRouteToken {
  chainName: string;
  addressOrDenom: string;
  collateralAddressOrDenom?: string;
  standard: string;
}

export interface TrustedWarpRoute {
  id: string;
  tokens: TrustedWarpRouteToken[];
}

export type TrustedWarpRouteMap = Record<string, TrustedWarpRoute>;

export async function loadTrustedWarpRoutes(registry: IRegistry): Promise<TrustedWarpRouteMap> {
  try {
    const routes = await registry.getWarpRoutes();
    if (!Object.keys(routes).length) return loadPublishedWarpRoutes();
    return buildTrustedWarpRouteMap(routes);
  } catch (error) {
    logger.warn('Failed to load trusted warp routes from registry, using published routes', error);
    return loadPublishedWarpRoutes();
  }
}

export function buildTrustedWarpRouteMap(
  routes: Record<string, WarpCoreConfig>,
): TrustedWarpRouteMap {
  return Object.entries(routes).reduce<TrustedWarpRouteMap>((acc, [id, route]) => {
    const tokens = route.tokens
      .map(toTrustedWarpRouteToken)
      .filter((token): token is TrustedWarpRouteToken => !!token);
    if (!tokens.length) return acc;
    acc[routeKey(id)] = { id, tokens };
    return acc;
  }, {});
}

export function getTrustedWarpRoute(
  routes: TrustedWarpRouteMap,
  routeId: string,
): TrustedWarpRoute | undefined {
  return routes[routeKey(routeId)];
}

function toTrustedWarpRouteToken(token: WarpRouteToken): TrustedWarpRouteToken | null {
  if (!token.addressOrDenom) return null;
  return {
    chainName: token.chainName,
    addressOrDenom: token.addressOrDenom,
    collateralAddressOrDenom: token.collateralAddressOrDenom,
    standard: token.standard,
  };
}

function routeKey(routeId: string): string {
  return routeId.toLowerCase();
}

async function loadPublishedWarpRoutes(): Promise<TrustedWarpRouteMap> {
  const { warpRouteConfigs } = await import('@hyperlane-xyz/registry');
  return buildTrustedWarpRouteMap(warpRouteConfigs as Record<string, WarpCoreConfig>);
}
