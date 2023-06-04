import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { HypERC20Collateral, TokenType } from '@hyperlane-xyz/hyperlane-token';
import { utils } from '@hyperlane-xyz/utils';

import { areAddressesEqual, isValidEvmAddress, normalizeEvmAddress } from '../../utils/addresses';
import { logger } from '../../utils/logger';
import { getCaip2Id } from '../chains/caip2';
import { ProtocolType } from '../chains/types';
import { getErc20Contract } from '../contracts/erc20';
import { getTokenRouterContract } from '../contracts/hypErc20';
import { getMultiProvider } from '../multiProvider';

import { getAllTokens } from './metadata';
import { TokenMetadata, TokenMetadataWithHypTokens } from './types';

export enum RouteType {
  BaseToSynthetic = 'baseToSynthetic',
  SyntheticToSynthetic = 'syntheticToSynthetic',
  SyntheticToBase = 'syntheticToBase',
}

export interface Route {
  type: RouteType;
  baseCaip2Id: Caip2Id;
  baseTokenAddress: Address;
  tokenRouterAddress: Address;
  originTokenAddress: Address;
  destTokenAddress: Address;
  decimals: number;
}

// Origin chain to destination chain to Route
export type RoutesMap = Record<Caip2Id, Record<Caip2Id, Route[]>>;

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

// TODO solana support here
async function fetchRemoteTokensForCollateralToken(
  token: TokenMetadata,
): Promise<TokenMetadataWithHypTokens> {
  const { type, chainId, symbol, decimals, tokenRouterAddress } = token;
  logger.info('Inspecting token:', symbol);
  const multiProvider = getMultiProvider();
  const provider = multiProvider.getProvider(chainId);
  const tokenRouterContract = getTokenRouterContract(type, tokenRouterAddress, provider);

  if (type === TokenType.collateral) {
    logger.info('Validating token metadata');
    const collateralContract = tokenRouterContract as HypERC20Collateral;
    const wrappedTokenAddr = await collateralContract.wrappedToken();
    const erc20 = getErc20Contract(wrappedTokenAddr, provider);
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
  const hypTokens = hypTokenAddresses.map((addr, i) => {
    const chainId = multiProvider.getChainId(domains[i]);
    const caip2Id = getCaip2Id(ProtocolType.Ethereum, chainId);
    return {
      caip2Id,
      address: normalizeEvmAddress(addr),
    };
  });
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
        caip2Id: baseCaip2Id,
        address: baseTokenAddress,
        tokenRouterAddress,
        decimals,
      } = token;
      const { caip2Id: syntheticCaip2Id, address: hypTokenAddress } = hypToken;

      const commonRouteProps = {
        baseCaip2Id,
        baseTokenAddress,
        tokenRouterAddress,
      };
      tokenRoutes[baseCaip2Id][syntheticCaip2Id].push({
        type: RouteType.BaseToSynthetic,
        ...commonRouteProps,
        originTokenAddress: tokenRouterAddress,
        destTokenAddress: hypTokenAddress,
        decimals,
      });
      tokenRoutes[syntheticCaip2Id][baseCaip2Id].push({
        type: RouteType.SyntheticToBase,
        ...commonRouteProps,
        originTokenAddress: hypTokenAddress,
        destTokenAddress: tokenRouterAddress,
        decimals,
      });

      for (const otherHypToken of token.hypTokens) {
        // Skip if it's same hypToken as parent loop
        if (otherHypToken.caip2Id === syntheticCaip2Id) continue;
        const { caip2Id: otherSynCaip2Id, address: otherHypTokenAddress } = otherHypToken;
        tokenRoutes[syntheticCaip2Id][otherSynCaip2Id].push({
          type: RouteType.SyntheticToSynthetic,
          ...commonRouteProps,
          originTokenAddress: hypTokenAddress,
          destTokenAddress: otherHypTokenAddress,
          decimals,
        });
        tokenRoutes[otherSynCaip2Id][syntheticCaip2Id].push({
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

function getChainsFromTokens(tokens: TokenMetadataWithHypTokens[]): Caip2Id[] {
  const chains = new Set<Caip2Id>();
  for (const token of tokens) {
    chains.add(token.caip2Id);
    for (const hypToken of token.hypTokens) {
      chains.add(hypToken.caip2Id);
    }
  }
  return Array.from(chains);
}

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
): Route | null {
  if (!isValidEvmAddress(baseTokenAddress)) return null;
  return (
    getTokenRoutes(originCaip2Id, destinationCaip2Id, tokenRoutes).find((r) =>
      areAddressesEqual(baseTokenAddress, r.baseTokenAddress),
    ) || null
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

export function useRouteChains(tokenRoutes: RoutesMap): Caip2Id[] {
  return useMemo(() => {
    const allCaip2Ids = Object.keys(tokenRoutes) as Caip2Id[];
    const collateralCaip2Ids = getAllTokens().map((t) => t.caip2Id);
    return allCaip2Ids.sort((c1, c2) => {
      // Surface collateral chains first
      if (collateralCaip2Ids.includes(c1) && !collateralCaip2Ids.includes(c2)) return -1;
      else if (!collateralCaip2Ids.includes(c1) && collateralCaip2Ids.includes(c2)) return 1;
      else return c1 > c2 ? 1 : -1;
    });
  }, [tokenRoutes]);
}
