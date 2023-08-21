import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ProtocolType } from '@hyperlane-xyz/sdk';

import { areAddressesEqual, bytesToProtocolAddress } from '../../../utils/addresses';
import { logger } from '../../../utils/logger';
import { getCaip2Id } from '../../caip/chains';
import {
  getCaip19Id,
  getChainIdFromToken,
  isNonFungibleToken,
  parseCaip19Id,
  resolveAssetNamespace,
} from '../../caip/tokens';
import { getMultiProvider } from '../../multiProvider';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { getTokens, parseTokens } from '../metadata';
import { TokenMetadata, TokenMetadataWithHypTokens } from '../types';

import { RouteType, RoutesMap } from './types';

export function useTokenRoutes() {
  const {
    isLoading,
    data: tokenRoutes,
    error,
  } = useQuery(
    ['token-routes'],
    async () => {
      logger.info('Searching for token routes');
      const parsedTokens = await parseTokens();
      const tokens: TokenMetadataWithHypTokens[] = [];
      for (const token of parsedTokens) {
        // Consider parallelizing here but concerned about RPC rate limits
        const tokenWithHypTokens = await fetchRemoteHypTokens(token, parsedTokens);
        tokens.push(tokenWithHypTokens);
      }
      return computeTokenRoutes(tokens);
    },
    { retry: false },
  );

  return { isLoading, error, tokenRoutes };
}

async function fetchRemoteHypTokens(
  baseToken: TokenMetadata,
  allTokens: TokenMetadata[],
): Promise<TokenMetadataWithHypTokens> {
  const {
    symbol: baseSymbol,
    tokenCaip19Id: baseTokenCaip19Id,
    routerAddress: baseRouter,
  } = baseToken;
  const isNft = isNonFungibleToken(baseTokenCaip19Id);
  logger.info(`Fetching remote tokens for symbol ${baseSymbol} (${baseTokenCaip19Id})`);

  const baseAdapter = AdapterFactory.HypCollateralAdapterFromAddress(baseTokenCaip19Id, baseRouter);

  const remoteRouters = await baseAdapter.getAllRouters();
  logger.info(`Router addresses found:`, remoteRouters);

  const multiProvider = getMultiProvider();
  const hypTokens = await Promise.all(
    remoteRouters.map(async (router) => {
      const destMetadata = multiProvider.getChainMetadata(router.domain);
      const protocol = destMetadata.protocol || ProtocolType.Ethereum;
      const chainCaip2Id = getCaip2Id(protocol, multiProvider.getChainId(router.domain));
      const namespace = resolveAssetNamespace(protocol, false, isNft, true);
      const formattedAddress = bytesToProtocolAddress(router.address, protocol);
      const tokenCaip19Id = getCaip19Id(chainCaip2Id, namespace, formattedAddress);
      if (isNft) return { tokenCaip19Id, decimals: 0 };
      // Attempt to find the decimals from the token list
      const routerMetadata = allTokens.find((token) =>
        areAddressesEqual(formattedAddress, token.routerAddress),
      );
      if (routerMetadata) return { tokenCaip19Id, decimals: routerMetadata.decimals };
      // Otherwise try to query the contract
      const remoteAdapter = AdapterFactory.HypSyntheticTokenAdapterFromAddress(
        baseTokenCaip19Id,
        chainCaip2Id,
        formattedAddress,
      );
      const metadata = await remoteAdapter.getMetadata();
      return { tokenCaip19Id, decimals: metadata.decimals };
    }),
  );
  return { ...baseToken, hypTokens };
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
        tokenCaip19Id: baseTokenCaip19Id,
        routerAddress: baseRouterAddress,
        decimals: baseDecimals,
      } = token;
      const baseChainCaip2Id = getChainIdFromToken(baseTokenCaip19Id);
      const { chainCaip2Id: syntheticCaip2Id, address: syntheticRouterAddress } = parseCaip19Id(
        hypToken.tokenCaip19Id,
      );
      const syntheticDecimals = hypToken.decimals;

      const commonRouteProps = {
        baseTokenCaip19Id,
        baseRouterAddress,
      };
      tokenRoutes[baseChainCaip2Id][syntheticCaip2Id]?.push({
        type: RouteType.BaseToSynthetic,
        ...commonRouteProps,
        originCaip2Id: baseChainCaip2Id,
        originRouterAddress: baseRouterAddress,
        originDecimals: baseDecimals,
        destCaip2Id: syntheticCaip2Id,
        destRouterAddress: syntheticRouterAddress,
        destDecimals: syntheticDecimals,
      });
      tokenRoutes[syntheticCaip2Id][baseChainCaip2Id]?.push({
        type: RouteType.SyntheticToBase,
        ...commonRouteProps,
        originCaip2Id: syntheticCaip2Id,
        originRouterAddress: syntheticRouterAddress,
        originDecimals: syntheticDecimals,
        destCaip2Id: baseChainCaip2Id,
        destRouterAddress: baseRouterAddress,
        destDecimals: baseDecimals,
      });

      for (const otherHypToken of token.hypTokens) {
        // Skip if it's same hypToken as parent loop (no route to self)
        if (otherHypToken === hypToken) continue;
        const { chainCaip2Id: otherSynCaip2Id, address: otherHypTokenAddress } = parseCaip19Id(
          otherHypToken.tokenCaip19Id,
        );
        tokenRoutes[syntheticCaip2Id][otherSynCaip2Id]?.push({
          type: RouteType.SyntheticToSynthetic,
          ...commonRouteProps,
          originCaip2Id: syntheticCaip2Id,
          originRouterAddress: syntheticRouterAddress,
          originDecimals: syntheticDecimals,
          destCaip2Id: otherSynCaip2Id,
          destRouterAddress: otherHypTokenAddress,
          destDecimals: otherHypToken.decimals,
        });
      }
    }
  }
  return tokenRoutes;
}

function getChainsFromTokens(tokens: TokenMetadataWithHypTokens[]): ChainCaip2Id[] {
  const chains = new Set<ChainCaip2Id>();
  for (const token of tokens) {
    chains.add(getChainIdFromToken(token.tokenCaip19Id));
    for (const hypToken of token.hypTokens) {
      chains.add(getChainIdFromToken(hypToken.tokenCaip19Id));
    }
  }
  return Array.from(chains);
}

export function useRouteChains(tokenRoutes: RoutesMap): ChainCaip2Id[] {
  return useMemo(() => {
    const allCaip2Ids = Object.keys(tokenRoutes) as ChainCaip2Id[];
    const collateralCaip2Ids = getTokens().map((t) => getChainIdFromToken(t.tokenCaip19Id));
    return allCaip2Ids.sort((c1, c2) => {
      // Surface collateral chains first
      if (collateralCaip2Ids.includes(c1) && !collateralCaip2Ids.includes(c2)) return -1;
      else if (!collateralCaip2Ids.includes(c1) && collateralCaip2Ids.includes(c2)) return 1;
      else return c1 > c2 ? 1 : -1;
    });
  }, [tokenRoutes]);
}
