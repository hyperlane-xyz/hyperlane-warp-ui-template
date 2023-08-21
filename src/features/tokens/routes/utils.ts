import { Route, RoutesMap } from './types';

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
