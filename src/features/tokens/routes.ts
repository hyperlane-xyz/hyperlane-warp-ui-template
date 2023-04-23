import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { HypERC20Collateral, TokenType } from '@hyperlane-xyz/hyperlane-token';
import { utils } from '@hyperlane-xyz/utils';

import { areAddressesEqual, isValidAddress, normalizeAddress } from '../../utils/addresses';
import { logger } from '../../utils/logger';
import { getErc20Contract } from '../contracts/erc20';
import { getTokenRouterContract } from '../contracts/hypErc20';
import { getProvider } from '../multiProvider';

import { getAllTokens } from './metadata';
import { TokenMetadata, TokenMetadataWithHypTokens } from './types';

export enum RouteType {
  BaseToSynthetic = 'baseToSynthetic',
  SyntheticToSynthetic = 'syntheticToSynthetic',
  SyntheticToBase = 'syntheticToBase',
}

export interface Route {
  type: RouteType;
  baseChainId: ChainId;
  baseTokenAddress: Address;
  tokenRouterAddress: Address;
  originTokenAddress: Address;
  destTokenAddress: Address;
  decimals: number;
}

// Origin chain to destination chain to Route
export type RoutesMap = Record<ChainId, Record<ChainId, Route[]>>;

export function useTokenRoutes() {
  const {
    isLoading,
    data: tokenRoutes,
    error,
  } = useQuery(
    ['token-routes'],
    async () => {
      logger.info('Searching for token routes');
      const tokens: TokenMetadataWithHypTokens[] = [];
      for (const token of getAllTokens()) {
        // Consider parallelizing here but concerned about RPC rate limits
        const tokenWithHypTokens = await fetchRemoteTokensForCollateralToken(token);
        tokens.push(tokenWithHypTokens);
      }
      return computeTokenRoutes(tokens);
    },
    { retry: false },
  );

  return { isLoading, error, tokenRoutes };
}

async function fetchRemoteTokensForCollateralToken(
  token: TokenMetadata,
): Promise<TokenMetadataWithHypTokens> {
  const { type, chainId, symbol, decimals, tokenRouterAddress } = token;
  logger.info('Inspecting token:', symbol);
  const provider = getProvider(chainId);
  const tokenRouterContract = getTokenRouterContract(type, tokenRouterAddress, provider);

  if (type === TokenType.collateral) {
    logger.info('Validating token metadata');
    const collateralContract = tokenRouterContract as HypERC20Collateral;
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
  }

  logger.info('Fetching connected domains');
  const domains = await tokenRouterContract.domains();
  logger.info(`Found ${domains.length} connected domains:`, domains);

  logger.info('Getting domain router address');
  const hypTokenAddressesAsBytes32 = await Promise.all(
    domains.map((d) => tokenRouterContract.routers(d)),
  );
  const hypTokenAddresses = hypTokenAddressesAsBytes32.map((b) => utils.bytes32ToAddress(b));
  logger.info(`Addresses found:`, hypTokenAddresses);
  const hypTokens = hypTokenAddresses.map((addr, i) => ({
    chainId: domains[i],
    address: normalizeAddress(addr),
  }));
  return { ...token, hypTokens };
}

// Process token list to populates routesCache with all possible token routes (e.g. router pairs)
function computeTokenRoutes(tokens: TokenMetadataWithHypTokens[]) {
  const tokenRoutes: RoutesMap = {};

  // Instantiate map structure
  const allChainIds = getChainsFromTokens(tokens);
  for (const origin of allChainIds) {
    tokenRoutes[origin] = {};
    for (const dest of allChainIds) {
      if (origin === dest) continue;
      tokenRoutes[origin][dest] = [];
    }
  }

  // Compute all possible routes, in both directions
  for (const token of tokens) {
    for (const hypToken of token.hypTokens) {
      const {
        chainId: baseChainId,
        address: baseTokenAddress,
        tokenRouterAddress,
        decimals,
      } = token;
      const { chainId: syntheticChainId, address: hypTokenAddress } = hypToken;

      const commonRouteProps = {
        baseChainId: baseChainId,
        baseTokenAddress,
        tokenRouterAddress,
      };
      tokenRoutes[baseChainId][syntheticChainId].push({
        type: RouteType.BaseToSynthetic,
        ...commonRouteProps,
        originTokenAddress: tokenRouterAddress,
        destTokenAddress: hypTokenAddress,
        decimals,
      });
      tokenRoutes[syntheticChainId][baseChainId].push({
        type: RouteType.SyntheticToBase,
        ...commonRouteProps,
        originTokenAddress: hypTokenAddress,
        destTokenAddress: tokenRouterAddress,
        decimals,
      });

      for (const otherHypToken of token.hypTokens) {
        // Skip if it's same hypToken as parent loop
        if (otherHypToken.chainId === syntheticChainId) continue;
        const { chainId: otherSynChainId, address: otherHypTokenAddress } = otherHypToken;
        tokenRoutes[syntheticChainId][otherSynChainId].push({
          type: RouteType.SyntheticToSynthetic,
          ...commonRouteProps,
          originTokenAddress: hypTokenAddress,
          destTokenAddress: otherHypTokenAddress,
          decimals,
        });
        tokenRoutes[otherSynChainId][syntheticChainId].push({
          type: RouteType.SyntheticToSynthetic,
          ...commonRouteProps,
          originTokenAddress: otherHypTokenAddress,
          destTokenAddress: hypTokenAddress,
          decimals,
        });
      }
    }
  }
  return tokenRoutes;
}

function getChainsFromTokens(tokens: TokenMetadataWithHypTokens[]) {
  const chains = new Set<number>();
  for (const token of tokens) {
    chains.add(token.chainId);
    for (const hypToken of token.hypTokens) {
      chains.add(hypToken.chainId);
    }
  }
  return Array.from(chains);
}

export function getTokenRoutes(
  originChainId: ChainId,
  destinationChainId: ChainId,
  tokenRoutes: RoutesMap,
): Route[] {
  return tokenRoutes[originChainId]?.[destinationChainId] || [];
}

export function getTokenRoute(
  originChainId: ChainId,
  destinationChainId: ChainId,
  baseTokenAddress: Address,
  tokenRoutes: RoutesMap,
): Route | null {
  if (!isValidAddress(baseTokenAddress)) return null;
  return (
    getTokenRoutes(originChainId, destinationChainId, tokenRoutes).find((r) =>
      areAddressesEqual(baseTokenAddress, r.baseTokenAddress),
    ) || null
  );
}

export function hasTokenRoute(
  originChainId: ChainId,
  destinationChainId: ChainId,
  baseTokenAddress: Address,
  tokenRoutes: RoutesMap,
): boolean {
  return !!getTokenRoute(originChainId, destinationChainId, baseTokenAddress, tokenRoutes);
}

export function useRouteChains(tokenRoutes: RoutesMap): ChainId[] {
  return useMemo(() => {
    const allChainIds = Object.keys(tokenRoutes).map((chainId) => parseInt(chainId));
    const collateralChainIds = getAllTokens().map((t) => t.chainId);
    return allChainIds.sort((c1, c2) => {
      // Surface collateral chains first
      if (collateralChainIds.includes(c1) && !collateralChainIds.includes(c2)) return -1;
      else if (!collateralChainIds.includes(c1) && collateralChainIds.includes(c2)) return 1;
      else return c1 - c2;
    });
  }, [tokenRoutes]);
}
