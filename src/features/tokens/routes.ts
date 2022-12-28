import { chainIdToMetadata } from '@hyperlane-xyz/sdk';

import SyntheticTokenList from '../../consts/tokens.hyperlane.xyz.json';
import { areAddressesEqual, isValidAddress } from '../../utils/addresses';

export enum RouteType {
  NativeToRemote = 'nativeToRemote',
  RemoteToRemote = 'remoteToRemote',
  RemoteToNative = 'remoteToNative',
}

interface Route {
  type: RouteType;
  nativeTokenAddress: Address;
  hypCollateralAddress: Address;
  sourceTokenAddress: Address;
  destTokenAddress: Address;
}

// Source chain to destination chain to Route
const routesCache: Record<number, Record<number, Route[]>> = {};

// Process token list to populates routesCache with all possible token routes (e.g. router pairs)
function populateRoutesCache() {
  // Instantiate cache structure
  const allChainIds = Object.keys(chainIdToMetadata);
  for (const source of allChainIds) {
    routesCache[source] = {};
    for (const dest of allChainIds) {
      if (source === dest) continue;
      routesCache[source][dest] = [];
    }
  }

  const tokens = SyntheticTokenList.tokens;
  for (const token of tokens) {
    for (const hypToken of token.hypTokenAddresses) {
      const { chainId: nativeChainId, address: nativeTokenAddress, hypCollateralAddress } = token;
      const { chainId: remoteChainId, address: hypTokenAddress } = hypToken;

      const commonRouteProps = {
        nativeTokenAddress,
        hypCollateralAddress,
      };
      routesCache[nativeChainId][remoteChainId].push({
        type: RouteType.NativeToRemote,
        ...commonRouteProps,
        sourceTokenAddress: hypCollateralAddress,
        destTokenAddress: hypTokenAddress,
      });
      routesCache[remoteChainId][nativeChainId].push({
        type: RouteType.RemoteToNative,
        ...commonRouteProps,
        sourceTokenAddress: hypTokenAddress,
        destTokenAddress: hypCollateralAddress,
      });

      for (const otherHypToken of token.hypTokenAddresses) {
        // Skip if it's same hypToken as parent loop
        if (otherHypToken.chainId === remoteChainId) continue;
        const { chainId: otherRemoteChainId, address: otherHypTokenAddress } = otherHypToken;
        routesCache[remoteChainId][otherRemoteChainId].push({
          type: RouteType.RemoteToRemote,
          ...commonRouteProps,
          sourceTokenAddress: hypTokenAddress,
          destTokenAddress: otherHypTokenAddress,
        });
        routesCache[otherRemoteChainId][remoteChainId].push({
          type: RouteType.RemoteToRemote,
          ...commonRouteProps,
          sourceTokenAddress: otherHypTokenAddress,
          destTokenAddress: hypTokenAddress,
        });
      }
    }
  }
}

export function getTokenRoutes(sourceChainId: number, destinationChainId: number): Route[] {
  if (!Object.keys(routesCache).length) populateRoutesCache();
  return routesCache[sourceChainId]?.[destinationChainId] || [];
}

export function getTokenRoute(
  sourceChainId: number,
  destinationChainId: number,
  nativeTokenAddress: Address,
): Route | null {
  if (!isValidAddress(nativeTokenAddress)) return null;
  return (
    getTokenRoutes(sourceChainId, destinationChainId).find((r) =>
      areAddressesEqual(nativeTokenAddress, r.nativeTokenAddress),
    ) || null
  );
}

export function hasTokenRoute(
  sourceChainId: number,
  destinationChainId: number,
  nativeTokenAddress: Address,
): boolean {
  return !!getTokenRoute(sourceChainId, destinationChainId, nativeTokenAddress);
}
