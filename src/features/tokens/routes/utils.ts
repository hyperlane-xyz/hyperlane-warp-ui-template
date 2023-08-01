import { Route, RoutesMap } from './types';

export function getTokenRoutes(
  originCaip2Id: Caip2Id,
  destinationCaip2Id: Caip2Id,
  tokenRoutes: RoutesMap,
): Route[] {
  return tokenRoutes[originCaip2Id]?.[destinationCaip2Id] || [];
}

export function getTokenRoute(
  originCaip2Id: Caip2Id,
  destinationCaip2Id: Caip2Id,
  caip19Id: Caip19Id,
  tokenRoutes: RoutesMap,
): Route | undefined {
  if (!caip19Id) return undefined;
  return getTokenRoutes(originCaip2Id, destinationCaip2Id, tokenRoutes).find(
    (r) => r.baseCaip19Id === caip19Id,
  );
}

export function hasTokenRoute(
  originCaip2Id: Caip2Id,
  destinationCaip2Id: Caip2Id,
  caip19Id: Caip19Id,
  tokenRoutes: RoutesMap,
): boolean {
  return !!getTokenRoute(originCaip2Id, destinationCaip2Id, caip19Id, tokenRoutes);
}
