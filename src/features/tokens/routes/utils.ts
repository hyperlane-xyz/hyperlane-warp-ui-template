import { deepCopy } from '@hyperlane-xyz/utils';

import { isNativeToken } from '../../caip/tokens';

import { IbcRoute, IbcToWarpRoute, Route, RouteType, RoutesMap, WarpRoute } from './types';

export function getTokenRoutes(
  originCaip2Id: ChainCaip2Id,
  destinationCaip2Id: ChainCaip2Id,
  tokenRoutes: RoutesMap,
): Route[] {
  return tokenRoutes[originCaip2Id]?.[destinationCaip2Id] || [];
}

export function getTokenRoute(
  originCaip2Id: ChainCaip2Id,
  destinationCaip2Id: ChainCaip2Id,
  tokenCaip19Id: TokenCaip19Id,
  tokenRoutes: RoutesMap,
): Route | undefined {
  if (!tokenCaip19Id) return undefined;
  return getTokenRoutes(originCaip2Id, destinationCaip2Id, tokenRoutes).find(
    (r) => r.baseTokenCaip19Id === tokenCaip19Id,
  );
}

export function hasTokenRoute(
  originCaip2Id: ChainCaip2Id,
  destinationCaip2Id: ChainCaip2Id,
  tokenCaip19Id: TokenCaip19Id,
  tokenRoutes: RoutesMap,
): boolean {
  return !!getTokenRoute(originCaip2Id, destinationCaip2Id, tokenCaip19Id, tokenRoutes);
}

export function isRouteToCollateral(route: Route) {
  return (
    route.type === RouteType.CollateralToCollateral ||
    route.type === RouteType.SyntheticToCollateral
  );
}

export function isRouteFromCollateral(route: Route) {
  return (
    route.type === RouteType.CollateralToCollateral ||
    route.type === RouteType.CollateralToSynthetic
  );
}

export function isRouteToSynthetic(route: Route) {
  return (
    route.type === RouteType.CollateralToSynthetic || route.type === RouteType.SyntheticToSynthetic
  );
}

export function isRouteFromSynthetic(route: Route) {
  return (
    route.type === RouteType.SyntheticToCollateral || route.type === RouteType.SyntheticToSynthetic
  );
}

export function isRouteFromNative(route: Route) {
  return isRouteFromCollateral(route) && isNativeToken(route.baseTokenCaip19Id);
}

export function isWarpRoute(route: Route): route is WarpRoute {
  return !isIbcRoute(route);
}

export function isIbcRoute(route: Route): route is IbcRoute | IbcToWarpRoute {
  return (
    route.type === RouteType.IbcNativeToIbcNative ||
    route.type === RouteType.IbcNativeToHypSynthetic
  );
}

// Differs from isIbcRoute above in that it it's only true for routes that
// Never interact with Hyperlane routers at all
export function isIbcOnlyRoute(route: Route): route is IbcRoute {
  return route.type === RouteType.IbcNativeToIbcNative;
}

export function isIbcToWarpRoute(route: Route): route is IbcToWarpRoute {
  return route.type === RouteType.IbcNativeToHypSynthetic;
}

export function mergeRoutes(routes: RoutesMap, newRoutes: Route[]) {
  const mergedRoutes = deepCopy(routes);
  for (const route of newRoutes) {
    mergedRoutes[route.originCaip2Id] ||= {};
    mergedRoutes[route.originCaip2Id][route.destCaip2Id] ||= [];
    mergedRoutes[route.originCaip2Id][route.destCaip2Id].push(route);
  }
  return mergedRoutes;
}
