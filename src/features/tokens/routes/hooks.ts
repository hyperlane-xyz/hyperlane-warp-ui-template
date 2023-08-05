import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { TokenType } from '@hyperlane-xyz/hyperlane-token';
import { ProtocolType } from '@hyperlane-xyz/sdk';

import { logger } from '../../../utils/logger';
import { getCaip2Id, getProtocolType } from '../../caip/chains';
import {
  getCaip2FromToken,
  getCaip19Id,
  isNonFungibleToken,
  parseCaip19Id,
  resolveAssetNamespace,
} from '../../caip/tokens';
import { getMultiProvider, getProvider } from '../../multiProvider';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { EvmTokenAdapter } from '../adapters/EvmTokenAdapter';
import { ITokenAdapter } from '../adapters/ITokenAdapter';
import { getHypErc20CollateralContract } from '../contracts/evmContracts';
import { getAllTokens } from '../metadata';
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
      const tokens: TokenMetadataWithHypTokens[] = [];
      for (const token of getAllTokens()) {
        // Consider parallelizing here but concerned about RPC rate limits
        await validateTokenMetadata(token);
        const tokenWithHypTokens = await fetchRemoteHypTokens(token);
        tokens.push(tokenWithHypTokens);
      }
      return computeTokenRoutes(tokens);
    },
    { retry: false },
  );

  return { isLoading, error, tokenRoutes };
}

async function validateTokenMetadata(token: TokenMetadata) {
  const { type, caip19Id, symbol, decimals, routerAddress } = token;
  const caip2Id = getCaip2FromToken(caip19Id);
  const isNft = isNonFungibleToken(caip19Id);

  // Native tokens cannot be queried for metadata
  if (type !== TokenType.collateral) return;

  logger.info(`Validating token ${symbol} on ${caip2Id}`);

  const protocol = getProtocolType(caip2Id);
  let tokenAdapter: ITokenAdapter;
  if (protocol === ProtocolType.Ethereum) {
    const provider = getProvider(caip2Id);
    const collateralContract = getHypErc20CollateralContract(routerAddress, provider);
    const wrappedTokenAddr = await collateralContract.wrappedToken();
    tokenAdapter = new EvmTokenAdapter(provider, wrappedTokenAddr);
  } else if (protocol === ProtocolType.Sealevel) {
    // TODO solana support when hyp tokens have metadata
    return;
  }

  const { decimals: decimalsOnChain, symbol: symbolOnChain } = await tokenAdapter!.getMetadata(
    isNft,
  );
  if (decimals !== decimalsOnChain) {
    throw new Error(
      `Token config decimals ${decimals} does not match contract decimals ${decimalsOnChain}`,
    );
  }
  if (symbol !== symbolOnChain) {
    throw new Error(
      `Token config symbol ${symbol} does not match contract decimals ${symbolOnChain}`,
    );
  }
}

async function fetchRemoteHypTokens(
  originToken: TokenMetadata,
): Promise<TokenMetadataWithHypTokens> {
  const { symbol, caip19Id, routerAddress } = originToken;
  const isNft = isNonFungibleToken(caip19Id);
  logger.info(`Fetching remote tokens for symbol ${symbol} (${caip19Id})`);

  const hypTokenAdapter = AdapterFactory.HypCollateralAdapterFromAddress(caip19Id, routerAddress);

  const remoteRouters = await hypTokenAdapter.getAllRouters();
  logger.info(`Router addresses found:`, remoteRouters);

  const multiProvider = getMultiProvider();
  const hypTokens = remoteRouters.map((router) => {
    const destMetadata = multiProvider.getChainMetadata(router.domain);
    const protocol = destMetadata.protocol || ProtocolType.Ethereum;
    const caip2Id = getCaip2Id(protocol, multiProvider.getChainId(router.domain));
    const namespace = resolveAssetNamespace(protocol, false, isNft, true);
    return getCaip19Id(caip2Id, namespace, router.address);
  });
  return { ...originToken, hypTokens };
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
      const { caip19Id: baseCaip19Id, routerAddress: baseRouterAddress, decimals } = token;
      const baseCaip2Id = getCaip2FromToken(baseCaip19Id);
      const { caip2Id: syntheticCaip2Id, address: syntheticRouterAddress } =
        parseCaip19Id(hypToken);

      const commonRouteProps = {
        baseCaip19Id,
        baseRouterAddress,
      };
      tokenRoutes[baseCaip2Id][syntheticCaip2Id]?.push({
        type: RouteType.BaseToSynthetic,
        ...commonRouteProps,
        originCaip2Id: baseCaip2Id,
        originRouterAddress: baseRouterAddress,
        destCaip2Id: syntheticCaip2Id,
        destRouterAddress: syntheticRouterAddress,
        decimals,
      });
      tokenRoutes[syntheticCaip2Id][baseCaip2Id]?.push({
        type: RouteType.SyntheticToBase,
        ...commonRouteProps,
        originCaip2Id: syntheticCaip2Id,
        originRouterAddress: syntheticRouterAddress,
        destCaip2Id: baseCaip2Id,
        destRouterAddress: baseRouterAddress,
        decimals,
      });

      for (const otherHypToken of token.hypTokens) {
        // Skip if it's same hypToken as parent loop (no route to self)
        if (otherHypToken === hypToken) continue;
        const { caip2Id: otherSynCaip2Id, address: otherHypTokenAddress } =
          parseCaip19Id(otherHypToken);
        tokenRoutes[syntheticCaip2Id][otherSynCaip2Id]?.push({
          type: RouteType.SyntheticToSynthetic,
          ...commonRouteProps,
          originCaip2Id: syntheticCaip2Id,
          originRouterAddress: syntheticRouterAddress,
          destCaip2Id: otherSynCaip2Id,
          destRouterAddress: otherHypTokenAddress,
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
    chains.add(getCaip2FromToken(token.caip19Id));
    for (const hypToken of token.hypTokens) {
      chains.add(getCaip2FromToken(hypToken));
    }
  }
  return Array.from(chains);
}

export function useRouteChains(tokenRoutes: RoutesMap): Caip2Id[] {
  return useMemo(() => {
    const allCaip2Ids = Object.keys(tokenRoutes) as Caip2Id[];
    const collateralCaip2Ids = getAllTokens().map((t) => getCaip2FromToken(t.caip19Id));
    return allCaip2Ids.sort((c1, c2) => {
      // Surface collateral chains first
      if (collateralCaip2Ids.includes(c1) && !collateralCaip2Ids.includes(c2)) return -1;
      else if (!collateralCaip2Ids.includes(c1) && collateralCaip2Ids.includes(c2)) return 1;
      else return c1 > c2 ? 1 : -1;
    });
  }, [tokenRoutes]);
}
