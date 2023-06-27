import { areAddressesEqual } from '../../../utils/addresses';

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
  baseTokenAddress: Address,
  tokenRoutes: RoutesMap,
): Route | undefined {
  if (!baseTokenAddress) return undefined;
  return getTokenRoutes(originCaip2Id, destinationCaip2Id, tokenRoutes).find((r) =>
    areAddressesEqual(baseTokenAddress, r.baseTokenAddress),
  );
}

export function hasTokenRoute(
  originCaip2Id: Caip2Id,
  destinationCaip2Id: Caip2Id,
  baseTokenAddress: Address,
  tokenRoutes: RoutesMap,
): boolean {
  return !!getTokenRoute(originCaip2Id, destinationCaip2Id, baseTokenAddress, tokenRoutes);
}
