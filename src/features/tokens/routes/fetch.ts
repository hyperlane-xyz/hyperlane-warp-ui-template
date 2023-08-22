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
import { TokenMetadata, TokenMetadataWithHypTokens } from '../types';

import { RouteType, RoutesMap } from './types';

export async function fetchRemoteHypTokens(
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
export function computeTokenRoutes(tokens: TokenMetadataWithHypTokens[]) {
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
      const { chainCaip2Id: remoteCaip2Id, address: remoteRouterAddress } = parseCaip19Id(
        remoteHypToken.tokenCaip19Id,
      );
      const remoteDecimals = remoteHypToken.decimals;
      // Check if the token list contains the dest router address, meaning it's also a base collateral token
      const isRemoteCollateral = tokensHasRouter(tokens, remoteRouterAddress);
      const commonRouteProps = { baseTokenCaip19Id, baseRouterAddress };

      // Register a route from the base to the remote
      tokenRoutes[baseChainCaip2Id][remoteCaip2Id]?.push({
        type: isRemoteCollateral
          ? RouteType.CollateralToCollateral
          : RouteType.CollateralToSynthetic,
        ...commonRouteProps,
        originCaip2Id: baseChainCaip2Id,
        originRouterAddress: baseRouterAddress,
        originDecimals: baseDecimals,
        destCaip2Id: remoteCaip2Id,
        destRouterAddress: remoteRouterAddress,
        destDecimals: remoteDecimals,
      });

      // If the remote is not a synthetic (i.e. it's a native/collateral token with it's own config)
      // then stop here to avoid duplicate route entries.
      if (isRemoteCollateral) continue;

      // Register a route back from the synthetic remote to the base
      tokenRoutes[remoteCaip2Id][baseChainCaip2Id]?.push({
        type: RouteType.SyntheticToCollateral,
        ...commonRouteProps,
        originCaip2Id: remoteCaip2Id,
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
        const { chainCaip2Id: otherSynCaip2Id, address: otherHypTokenAddress } = parseCaip19Id(
          otherHypToken.tokenCaip19Id,
        );
        // Skip if it's same hypToken as parent loop (no route to self)
        // or if if remote isn't a synthetic
        if (otherHypToken === remoteHypToken || tokensHasRouter(tokens, otherHypTokenAddress))
          continue;

        tokenRoutes[remoteCaip2Id][otherSynCaip2Id]?.push({
          type: RouteType.SyntheticToSynthetic,
          ...commonRouteProps,
          originCaip2Id: remoteCaip2Id,
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
      chains.add(getChainIdFromToken(hypToken.tokenCaip19Id));
    }
  }
  return Array.from(chains);
}

function tokensHasRouter(tokens: TokenMetadataWithHypTokens[], router: Address) {
  return !!tokens.find((t) => areAddressesEqual(t.routerAddress, router));
}
