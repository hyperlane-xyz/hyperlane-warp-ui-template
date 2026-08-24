import type { IRegistry } from '@hyperlane-xyz/registry';
import {
  EvmHypOwnerCollateralAdapter,
  TokenStandard,
  type MultiProtocolProvider,
  type WarpCoreConfig,
} from '@hyperlane-xyz/sdk';
import { retryAsync } from '@hyperlane-xyz/utils';

import { logger } from '../../utils/logger';
import type { QuoteBridgeStep, RouteResponse } from '../api/types';
import { sameTokenAddress } from '../routeSecurity/utils';

type WarpRouteToken = WarpCoreConfig['tokens'][number];

export interface RegistryWarpRouteToken {
  chainName: string;
  addressOrDenom: string;
  collateralAddressOrDenom?: string;
  underlyingAddressOrDenom?: string;
  standard: string;
}

export interface RegistryWarpRoute {
  id: string;
  tokens: RegistryWarpRouteToken[];
}

export type RegistryWarpRouteMap = Record<string, RegistryWarpRoute>;

const VAULT_COLLATERAL_STANDARDS: ReadonlySet<string> = new Set([
  TokenStandard.EvmHypOwnerCollateral,
  TokenStandard.EvmHypRebaseCollateral,
  // TODO: Support Tron vault standards with the SDK's Tron provider and address conversion.
]);

export async function loadRegistryWarpRoutes(registry: IRegistry): Promise<RegistryWarpRouteMap> {
  try {
    const routes = await registry.getWarpRoutes();
    const routeMap = buildRegistryWarpRouteMap(routes);
    return Object.keys(routeMap).length ? routeMap : loadPublishedWarpRoutes();
  } catch (error) {
    logger.warn('Failed to load registry warp routes, using published routes', error);
    return loadPublishedWarpRoutes();
  }
}

export function buildRegistryWarpRouteMap(
  routes: Record<string, WarpCoreConfig>,
): RegistryWarpRouteMap {
  return Object.entries(routes).reduce<RegistryWarpRouteMap>((acc, [id, route]) => {
    const tokens = route.tokens
      .map(toRegistryWarpRouteToken)
      .filter((token): token is RegistryWarpRouteToken => !!token);
    if (!tokens.length) return acc;
    acc[routeKey(id)] = { id, tokens };
    return acc;
  }, {});
}

export function getRegistryWarpRoute(
  routes: RegistryWarpRouteMap,
  routeId: string,
): RegistryWarpRoute | undefined {
  return routes[routeKey(routeId)];
}

export function createQuotedVaultCollateralTokenResolver() {
  const underlyingTokenCache = new Map<string, Promise<string>>();

  return async (
    routes: RegistryWarpRouteMap,
    quotedRoutes: RouteResponse[],
    multiProvider: MultiProtocolProvider,
  ): Promise<RegistryWarpRouteMap> => {
    // Match the quoted bridge against the registry before any RPC. The API
    // router is never used as the wrappedToken() call target.
    const quotedVaultRoutes = new Map<string, RegistryWarpRoute>();
    for (const quotedRoute of quotedRoutes) {
      const bridge = quotedRoute.steps.find(
        (step): step is QuoteBridgeStep => step.type === 'bridge',
      );
      const id = quotedRoute.connection?.warpRouteId ?? bridge?.warpRouteId;
      if (!id || !bridge) continue;

      const route = getRegistryWarpRoute(routes, id);
      if (!route?.tokens.some((token) => isVaultCollateralWarpStandard(token.standard))) continue;

      let originChainName: string;
      try {
        originChainName = multiProvider.getChainName(bridge.chain);
      } catch {
        continue;
      }
      const trustedOrigin = route.tokens.some(
        (token) =>
          token.chainName === originChainName &&
          sameTokenAddress(token.addressOrDenom, bridge.router),
      );
      if (trustedOrigin) quotedVaultRoutes.set(routeKey(id), route);
    }
    if (!quotedVaultRoutes.size) return routes;

    const resolvedEntries = await Promise.all(
      Array.from(quotedVaultRoutes).map(async ([key, route]) => {
        const tokens = await Promise.all(
          route.tokens.map(async (token) => {
            if (!isVaultCollateralWarpStandard(token.standard)) return token;
            if (token.underlyingAddressOrDenom) return token;

            try {
              const underlyingAddressOrDenom = await resolveVaultUnderlyingToken(
                token,
                multiProvider,
                underlyingTokenCache,
              );
              return { ...token, underlyingAddressOrDenom };
            } catch (error) {
              logger.warn(
                `Failed to resolve vault collateral token for ${route.id} on ${token.chainName}`,
                error,
              );
              return token;
            }
          }),
        );
        return [key, { ...route, tokens }] as const;
      }),
    );

    return { ...routes, ...Object.fromEntries(resolvedEntries) };
  };
}

export const resolveQuotedVaultCollateralTokens = createQuotedVaultCollateralTokenResolver();

export function isVaultCollateralWarpStandard(standard: string): boolean {
  return VAULT_COLLATERAL_STANDARDS.has(standard);
}

function toRegistryWarpRouteToken(token: WarpRouteToken): RegistryWarpRouteToken | null {
  if (!token.addressOrDenom) return null;
  return {
    chainName: token.chainName,
    addressOrDenom: token.addressOrDenom,
    collateralAddressOrDenom: token.collateralAddressOrDenom,
    standard: token.standard,
  };
}

function routeKey(routeId: string): string {
  return routeId.toLowerCase();
}

async function resolveVaultUnderlyingToken(
  token: RegistryWarpRouteToken,
  multiProvider: MultiProtocolProvider,
  cache: Map<string, Promise<string>>,
): Promise<string> {
  const key = `${token.chainName.toLowerCase()}:${token.addressOrDenom.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // Owner and rebase collateral routers share wrappedToken(). Cache the
  // in-flight promise so quote refreshes and concurrent quotes reuse it.
  const adapter = new EvmHypOwnerCollateralAdapter(token.chainName, multiProvider, {
    token: token.addressOrDenom,
  });
  const resolution = retryAsync(() => adapter.getWrappedTokenAddress(), 3).catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, resolution);
  return resolution;
}

async function loadPublishedWarpRoutes(): Promise<RegistryWarpRouteMap> {
  const { warpRouteConfigs } = await import('@hyperlane-xyz/registry');
  return buildRegistryWarpRouteMap(warpRouteConfigs as Record<string, WarpCoreConfig>);
}
