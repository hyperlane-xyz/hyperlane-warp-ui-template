import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { utils } from '@hyperlane-xyz/utils';

import { areAddressesEqual, isValidAddress, normalizeAddress } from '../../utils/addresses';
import { logger } from '../../utils/logger';
import { getErc20Contract } from '../contracts/erc20';
import { getHypErc20CollateralContract } from '../contracts/hypErc20';
import { getProvider } from '../multiProvider';

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
  decimals: number;
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
      const {
        chainId: nativeChainId,
        address: nativeTokenAddress,
        hypCollateralAddress,
        decimals,
      } = token;
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
        decimals,
      });
      tokenRoutes[remoteChainId][nativeChainId].push({
        type: RouteType.RemoteToNative,
        ...commonRouteProps,
        sourceTokenAddress: hypTokenAddress,
        destTokenAddress: hypCollateralAddress,
        decimals,
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
          decimals,
        });
        tokenRoutes[otherRemoteChainId][remoteChainId].push({
          type: RouteType.RemoteToRemote,
          ...commonRouteProps,
          sourceTokenAddress: otherHypTokenAddress,
          destTokenAddress: hypTokenAddress,
          decimals,
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
    data: tokenRoutes,
    error,
  } = useQuery(
    ['token-routes'],
    async () => {
      logger.info('Searching for token routes');
      const tokens: ListedTokenWithHypTokens[] = [];
      for (const token of getAllTokens()) {
        const { chainId, symbol, decimals, hypCollateralAddress } = token;
        logger.info('Inspecting token:', symbol);
        const provider = getProvider(chainId);
        const collateralContract = getHypErc20CollateralContract(hypCollateralAddress, provider);

        logger.info('Validating token metadata');
        const wrappedTokenAddr = await collateralContract.wrappedToken();
        const erc20 = getErc20Contract(wrappedTokenAddr, getProvider(chainId));
        const decimalsOnChain = await erc20.decimals();
        if (decimals !== decimalsOnChain) {
          throw new Error(
            `Token config decimals ${decimals} does not match contract decimals ${decimalsOnChain}`,
          );
        }
        const symbolOnChain = await erc20.symbol();
        if (symbol !== symbolOnChain) {
          throw new Error(
            `Token config symbol ${symbol} does not match contract decimals ${symbolOnChain}`,
          );
        }

        logger.info('Fetching connected domains');
        const domains = await collateralContract.domains();
        logger.info(`Found ${domains.length} connected domains:`, domains);

        logger.info('Getting domain router address');
        const hypTokenByteAddresses = await Promise.all(
          domains.map((d) => collateralContract.routers(d)),
        );
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

  return { isLoading, error, tokenRoutes };
}

export function useRouteChains(tokenRoutes: RoutesMap): number[] {
  return useMemo(() => Object.keys(tokenRoutes).map((chainId) => parseInt(chainId)), [tokenRoutes]);
}
