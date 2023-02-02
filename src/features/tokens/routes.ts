import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { utils } from '@hyperlane-xyz/utils';

import { areAddressesEqual, isValidAddress, normalizeAddress } from '../../utils/addresses';
import { logger } from '../../utils/logger';
import { getHypErc20CollateralContract } from '../contracts/hypErc20';
import { getProvider } from '../providers';

import { getAllTokens } from './metadata';
import { ListedTokenWithHypTokens } from './types';

export enum RouteType {
  NativeToRemote = 'nativeToRemote',
  RemoteToRemote = 'remoteToRemote',
  RemoteToNative = 'remoteToNative',
}

export interface Route {
  type: RouteType;
  nativeChainId: number;
  nativeTokenAddress: Address;
  hypCollateralAddress: Address;
  sourceTokenAddress: Address;
  destTokenAddress: Address;
}

// Source chain to destination chain to Route
export type RoutesMap = Record<number, Record<number, Route[]>>;

// Process token list to populates routesCache with all possible token routes (e.g. router pairs)
function computeTokenRoutes(tokens: ListedTokenWithHypTokens[]) {
  const tokenRoutes: RoutesMap = {};

  // Instantiate map structure
  const allChainIds = getChainsFromTokens(tokens);
  for (const source of allChainIds) {
    tokenRoutes[source] = {};
    for (const dest of allChainIds) {
      if (source === dest) continue;
      tokenRoutes[source][dest] = [];
    }
  }

  // Compute all possible routes, in both directions
  for (const token of tokens) {
    for (const hypToken of token.hypTokens) {
      const { chainId: nativeChainId, address: nativeTokenAddress, hypCollateralAddress } = token;
      const { chainId: remoteChainId, address: hypTokenAddress } = hypToken;

      const commonRouteProps = {
        nativeChainId,
        nativeTokenAddress,
        hypCollateralAddress,
      };
      tokenRoutes[nativeChainId][remoteChainId].push({
        type: RouteType.NativeToRemote,
        ...commonRouteProps,
        sourceTokenAddress: hypCollateralAddress,
        destTokenAddress: hypTokenAddress,
      });
      tokenRoutes[remoteChainId][nativeChainId].push({
        type: RouteType.RemoteToNative,
        ...commonRouteProps,
        sourceTokenAddress: hypTokenAddress,
        destTokenAddress: hypCollateralAddress,
      });

      for (const otherHypToken of token.hypTokens) {
        // Skip if it's same hypToken as parent loop
        if (otherHypToken.chainId === remoteChainId) continue;
        const { chainId: otherRemoteChainId, address: otherHypTokenAddress } = otherHypToken;
        tokenRoutes[remoteChainId][otherRemoteChainId].push({
          type: RouteType.RemoteToRemote,
          ...commonRouteProps,
          sourceTokenAddress: hypTokenAddress,
          destTokenAddress: otherHypTokenAddress,
        });
        tokenRoutes[otherRemoteChainId][remoteChainId].push({
          type: RouteType.RemoteToRemote,
          ...commonRouteProps,
          sourceTokenAddress: otherHypTokenAddress,
          destTokenAddress: hypTokenAddress,
        });
      }
    }
  }
  return tokenRoutes;
}

function getChainsFromTokens(tokens: ListedTokenWithHypTokens[]) {
  const chains = new Set<number>();
  for (const token of tokens) {
    chains.add(token.chainId);
    for (const remoteToken of token.hypTokens) {
      chains.add(remoteToken.chainId);
    }
  }
  return Array.from(chains);
}

export function getTokenRoutes(
  sourceChainId: number,
  destinationChainId: number,
  tokenRoutes: RoutesMap,
): Route[] {
  return tokenRoutes[sourceChainId]?.[destinationChainId] || [];
}

export function getTokenRoute(
  sourceChainId: number,
  destinationChainId: number,
  nativeTokenAddress: Address,
  tokenRoutes: RoutesMap,
): Route | null {
  if (!isValidAddress(nativeTokenAddress)) return null;
  return (
    getTokenRoutes(sourceChainId, destinationChainId, tokenRoutes).find((r) =>
      areAddressesEqual(nativeTokenAddress, r.nativeTokenAddress),
    ) || null
  );
}

export function hasTokenRoute(
  sourceChainId: number,
  destinationChainId: number,
  nativeTokenAddress: Address,
  tokenRoutes: RoutesMap,
): boolean {
  return !!getTokenRoute(sourceChainId, destinationChainId, nativeTokenAddress, tokenRoutes);
}

export function useTokenRoutes() {
  const {
    isLoading,
    isError: hasError,
    data: tokenRoutes,
  } = useQuery(
    ['token-routes'],
    async () => {
      logger.info('Searching for token routes');
      const tokens: ListedTokenWithHypTokens[] = [];
      for (const token of getAllTokens()) {
        logger.info('Inspecting token:', token.symbol);
        const provider = getProvider(token.chainId);
        const collateralContract = getHypErc20CollateralContract(
          token.hypCollateralAddress,
          provider,
        );
        logger.info('Fetching connected domains');
        const domains = await collateralContract.domains();
        logger.info(`Found ${domains.length} connected domains:`, domains);

        logger.info('Getting domain router address');
        const hypTokenByteAddressesP = domains.map((d) => collateralContract.routers(d));
        const hypTokenByteAddresses = await Promise.all(hypTokenByteAddressesP);
        const hypTokenAddresses = hypTokenByteAddresses.map((b) => utils.bytes32ToAddress(b));
        logger.info(`Addresses found:`, hypTokenAddresses);
        const hypTokens = hypTokenAddresses.map((addr, i) => ({
          chainId: domains[i],
          address: normalizeAddress(addr),
        }));
        tokens.push({ ...token, hypTokens });
      }

      return computeTokenRoutes(tokens);
    },
    { retry: false },
  );

  return { isLoading, hasError, tokenRoutes };
}

export function useRouteChains(tokenRoutes: RoutesMap): number[] {
  return useMemo(() => Object.keys(tokenRoutes).map((chainId) => parseInt(chainId)), [tokenRoutes]);
}
