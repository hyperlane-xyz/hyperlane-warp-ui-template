import { ProtocolType, bytesToProtocolAddress, deepCopy, eqAddress } from '@hyperlane-xyz/utils';

import { ibcRoutes } from '../../consts/ibcRoutes';
import { WarpContext } from '../../context/context';
import { getCaip2Id } from '../../features/caip/chains';
import { getChainIdFromToken, isNonFungibleToken } from '../../features/caip/tokens';
import { Route, RouteType, RoutesMap } from '../../features/routes/types';
import { AdapterFactory } from '../../features/tokens/AdapterFactory';
import { isIbcToken } from '../../features/tokens/metadata';
import { TokenMetadata, TokenMetadataWithHypTokens } from '../../features/tokens/types';
import { logger } from '../../utils/logger';

export async function getRouteConfigs(context: WarpContext): Promise<RoutesMap> {
  logger.info('Searching for token routes');
  const processedTokens: TokenMetadataWithHypTokens[] = [];
  for (const token of context.tokens) {
    // Skip querying of IBC tokens
    if (isIbcToken(token)) continue;
    const tokenWithHypTokens = await fetchRemoteHypTokens(context, token);
    processedTokens.push(tokenWithHypTokens);
  }
  let routes = computeTokenRoutes(processedTokens);

  if (ibcRoutes) {
    logger.info('Found ibc route configs, adding to route map');
    routes = mergeRoutes(routes, ibcRoutes);
  }

  logger.info('Done searching for token routes');
  return routes;
}

export async function fetchRemoteHypTokens(
  context: WarpContext,
  baseToken: TokenMetadata,
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
  logger.info(`Router addresses found:`, remoteRouters.length);

  const hypTokens = await Promise.all(
    remoteRouters.map(async (router) => {
      const destMetadata = context.multiProvider.getChainMetadata(router.domain);
      const protocol = destMetadata.protocol || ProtocolType.Ethereum;
      const chain = getCaip2Id(protocol, context.multiProvider.getChainId(router.domain));
      const formattedAddress = bytesToProtocolAddress(router.address, protocol);
      if (isNft) return { chain, router: formattedAddress, decimals: 0 };
      // Attempt to find the decimals from the token list
      const routerMetadata = context.tokens.find((token) =>
        eqAddress(formattedAddress, token.routerAddress),
      );
      if (routerMetadata)
        return { chain, router: formattedAddress, decimals: routerMetadata.decimals };
      // Otherwise try to query the contract
      const remoteAdapter = AdapterFactory.HypSyntheticTokenAdapterFromAddress(
        baseTokenCaip19Id,
        chain,
        formattedAddress,
      );
      const metadata = await remoteAdapter.getMetadata();
      return { chain, router: formattedAddress, decimals: metadata.decimals };
    }),
  );
  return { ...baseToken, hypTokens };
}

// Process token list to populates routesCache with all possible token routes (e.g. router pairs)
export function computeTokenRoutes(tokens: TokenMetadataWithHypTokens[]): RoutesMap {
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
    for (const remoteHypToken of token.hypTokens) {
      const {
        tokenCaip19Id: baseTokenCaip19Id,
        routerAddress: baseRouterAddress,
        decimals: baseDecimals,
      } = token;
      const baseChainCaip2Id = getChainIdFromToken(baseTokenCaip19Id);
      const {
        chain: remoteChainCaip2Id,
        router: remoteRouterAddress,
        decimals: remoteDecimals,
      } = remoteHypToken;
      // Check if the token list contains the dest router address, meaning it's also a base collateral token
      const remoteBaseTokenConfig = findTokenByRouter(tokens, remoteRouterAddress);
      const commonRouteProps = { baseTokenCaip19Id, baseRouterAddress };

      // Register a route from the base to the remote
      tokenRoutes[baseChainCaip2Id][remoteChainCaip2Id]?.push({
        type: remoteBaseTokenConfig
          ? RouteType.CollateralToCollateral
          : RouteType.CollateralToSynthetic,
        ...commonRouteProps,
        originCaip2Id: baseChainCaip2Id,
        originRouterAddress: baseRouterAddress,
        originDecimals: baseDecimals,
        destCaip2Id: remoteChainCaip2Id,
        destRouterAddress: remoteRouterAddress,
        destDecimals: remoteDecimals,
        destTokenCaip19Id: remoteBaseTokenConfig ? remoteBaseTokenConfig.tokenCaip19Id : undefined,
      });

      // If the remote is not a synthetic (i.e. it's a native/collateral token with it's own config)
      // then stop here to avoid duplicate route entries.
      if (remoteBaseTokenConfig) continue;

      // Register a route back from the synthetic remote to the base
      tokenRoutes[remoteChainCaip2Id][baseChainCaip2Id]?.push({
        type: RouteType.SyntheticToCollateral,
        ...commonRouteProps,
        originCaip2Id: remoteChainCaip2Id,
        originRouterAddress: remoteRouterAddress,
        originDecimals: remoteDecimals,
        destCaip2Id: baseChainCaip2Id,
        destRouterAddress: baseRouterAddress,
        destDecimals: baseDecimals,
      });

      // Now create routes from the remote synthetic token to all other hypTokens
      // This assumes the synthetics were all enrolled to connect to each other
      // which is the deployer's default behavior
      for (const otherHypToken of token.hypTokens) {
        const { chain: otherSynCaip2Id, router: otherHypTokenAddress } = otherHypToken;
        // Skip if it's same hypToken as parent loop (no route to self)
        if (otherHypToken === remoteHypToken) continue;
        // Also skip if remote isn't a synthetic (i.e. has a collateral/native config)
        if (findTokenByRouter(tokens, otherHypTokenAddress)) continue;

        tokenRoutes[remoteChainCaip2Id][otherSynCaip2Id]?.push({
          type: RouteType.SyntheticToSynthetic,
          ...commonRouteProps,
          originCaip2Id: remoteChainCaip2Id,
          originRouterAddress: remoteRouterAddress,
          originDecimals: remoteDecimals,
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
      chains.add(hypToken.chain);
    }
  }
  return Array.from(chains);
}

function findTokenByRouter(tokens: TokenMetadataWithHypTokens[], router: Address) {
  return tokens.find((t) => eqAddress(t.routerAddress, router));
}

export function mergeRoutes(routes: RoutesMap, newRoutes: Route[]) {
  const mergedRoutes = deepCopy(routes);
  for (const route of newRoutes) {
    mergedRoutes[route.originCaip2Id] ||= {};
    mergedRoutes[route.originCaip2Id][route.destCaip2Id] ||= [];
    mergedRoutes[route.originCaip2Id][route.destCaip2Id].push(route);
  }
  return mergedRoutes;
}
