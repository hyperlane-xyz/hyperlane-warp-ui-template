import type { IRegistry } from '@hyperlane-xyz/registry';
import {
  EvmHypOwnerCollateralAdapter,
  TokenStandard,
  type MultiProtocolProvider,
  type WarpCoreConfig,
} from '@hyperlane-xyz/sdk';

import { logger } from '../../utils/logger';

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
  TokenStandard.TronHypOwnerCollateral,
  TokenStandard.TronHypRebaseCollateral,
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

export async function resolveRegistryVaultCollateralTokens(
  routes: RegistryWarpRouteMap,
  multiProvider: MultiProtocolProvider,
): Promise<RegistryWarpRouteMap> {
  const entries = await Promise.all(
    Object.entries(routes).map(async ([key, route]) => {
      const tokens = await Promise.all(
        route.tokens.map(async (token) => {
          if (!isVaultCollateralWarpStandard(token.standard)) return token;

          try {
            // Owner and rebase collateral routers share wrappedToken().
            const adapter = new EvmHypOwnerCollateralAdapter(token.chainName, multiProvider, {
              token: token.addressOrDenom,
            });
            const underlyingAddressOrDenom = await adapter.getWrappedTokenAddress();
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

  return Object.fromEntries(entries);
}

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

async function loadPublishedWarpRoutes(): Promise<RegistryWarpRouteMap> {
  const { warpRouteConfigs } = await import('@hyperlane-xyz/registry');
  return buildRegistryWarpRouteMap(warpRouteConfigs as Record<string, WarpCoreConfig>);
}
