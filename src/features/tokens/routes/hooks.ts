import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ProtocolType } from '@hyperlane-xyz/sdk';

import { areAddressesEqual, bytesToProtocolAddress } from '../../../utils/addresses';
import { logger } from '../../../utils/logger';
import { getCaip2Id } from '../../caip/chains';
import {
  getCaip2FromToken,
  getCaip19Id,
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
  const { symbol: baseSymbol, caip19Id: baseCaip19Id, routerAddress: baseRouter } = baseToken;
  const isNft = isNonFungibleToken(baseCaip19Id);
  logger.info(`Fetching remote tokens for symbol ${baseSymbol} (${baseCaip19Id})`);

  const baseAdapter = AdapterFactory.HypCollateralAdapterFromAddress(baseCaip19Id, baseRouter);

  const remoteRouters = await baseAdapter.getAllRouters();
  logger.info(`Router addresses found:`, remoteRouters);

  const multiProvider = getMultiProvider();
  const hypTokens = await Promise.all(
    remoteRouters.map(async (router) => {
      const destMetadata = multiProvider.getChainMetadata(router.domain);
      const protocol = destMetadata.protocol || ProtocolType.Ethereum;
      const caip2Id = getCaip2Id(protocol, multiProvider.getChainId(router.domain));
      const namespace = resolveAssetNamespace(protocol, false, isNft, true);
      const formattedAddress = bytesToProtocolAddress(router.address, protocol);
      const caip19Id = getCaip19Id(caip2Id, namespace, formattedAddress);
      if (isNft) return { caip19Id, decimals: 0 };
      // Attempt to find the decimals from the token list
      const routerMetadata = allTokens.find((token) =>
        areAddressesEqual(formattedAddress, token.routerAddress),
      );
      if (routerMetadata) return { caip19Id, decimals: routerMetadata.decimals };
      // Otherwise try to query the contract
      const remoteAdapter = AdapterFactory.HypSyntheticTokenAdapterFromAddress(
        baseCaip19Id,
        caip2Id,
        formattedAddress,
      );
      const metadata = await remoteAdapter.getMetadata();
      return { caip19Id, decimals: metadata.decimals };
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
        caip19Id: baseCaip19Id,
        routerAddress: baseRouterAddress,
        decimals: baseDecimals,
      } = token;
      const baseCaip2Id = getCaip2FromToken(baseCaip19Id);
      const { caip2Id: syntheticCaip2Id, address: syntheticRouterAddress } = parseCaip19Id(
        hypToken.caip19Id,
      );
      const syntheticDecimals = hypToken.decimals;

      const commonRouteProps = {
        baseCaip19Id,
        baseRouterAddress,
      };
      tokenRoutes[baseCaip2Id][syntheticCaip2Id]?.push({
        type: RouteType.BaseToSynthetic,
        ...commonRouteProps,
        originCaip2Id: baseCaip2Id,
        originRouterAddress: baseRouterAddress,
        originDecimals: baseDecimals,
        destCaip2Id: syntheticCaip2Id,
        destRouterAddress: syntheticRouterAddress,
        destDecimals: syntheticDecimals,
      });
      tokenRoutes[syntheticCaip2Id][baseCaip2Id]?.push({
        type: RouteType.SyntheticToBase,
        ...commonRouteProps,
        originCaip2Id: syntheticCaip2Id,
        originRouterAddress: syntheticRouterAddress,
        originDecimals: syntheticDecimals,
        destCaip2Id: baseCaip2Id,
        destRouterAddress: baseRouterAddress,
        destDecimals: baseDecimals,
      });

      for (const otherHypToken of token.hypTokens) {
        // Skip if it's same hypToken as parent loop (no route to self)
        if (otherHypToken === hypToken) continue;
        const { caip2Id: otherSynCaip2Id, address: otherHypTokenAddress } = parseCaip19Id(
          otherHypToken.caip19Id,
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

function getChainsFromTokens(tokens: TokenMetadataWithHypTokens[]): Caip2Id[] {
  const chains = new Set<Caip2Id>();
  for (const token of tokens) {
    chains.add(getCaip2FromToken(token.caip19Id));
    for (const hypToken of token.hypTokens) {
      chains.add(getCaip2FromToken(hypToken.caip19Id));
    }
  }
  return Array.from(chains);
}

export function useRouteChains(tokenRoutes: RoutesMap): Caip2Id[] {
  return useMemo(() => {
    const allCaip2Ids = Object.keys(tokenRoutes) as Caip2Id[];
    const collateralCaip2Ids = getTokens().map((t) => getCaip2FromToken(t.caip19Id));
    return allCaip2Ids.sort((c1, c2) => {
      // Surface collateral chains first
      if (collateralCaip2Ids.includes(c1) && !collateralCaip2Ids.includes(c2)) return -1;
      else if (!collateralCaip2Ids.includes(c1) && collateralCaip2Ids.includes(c2)) return 1;
      else return c1 > c2 ? 1 : -1;
    });
  }, [tokenRoutes]);
}
