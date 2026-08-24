import type { IRegistry } from '@hyperlane-xyz/registry';
import {
  EvmHypOwnerCollateralAdapter,
  TokenStandard,
  type MultiProtocolProvider,
  type WarpCoreConfig,
} from '@hyperlane-xyz/sdk';
import { retryAsync, runWithTimeout } from '@hyperlane-xyz/utils';

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
const VAULT_RESOLUTION_TIMEOUT_MS = 5_000;
const VAULT_RESOLUTION_BACKOFF_MS = 60_000;

interface VaultCollateralResolverOptions {
  now?: () => number;
  resolutionTimeoutMs?: number;
  failureBackoffMs?: number;
}

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

export function createQuotedVaultCollateralTokenResolver(
  options: VaultCollateralResolverOptions = {},
) {
  const underlyingTokenCache = new Map<string, Promise<string>>();
  const failedAtCache = new Map<string, number>();
  const now = options.now ?? Date.now;
  const resolutionTimeoutMs = options.resolutionTimeoutMs ?? VAULT_RESOLUTION_TIMEOUT_MS;
  const failureBackoffMs = options.failureBackoffMs ?? VAULT_RESOLUTION_BACKOFF_MS;

  return async (
    routes: RegistryWarpRouteMap,
    quotedRoutes: RouteResponse[],
    multiProvider: MultiProtocolProvider,
    signal?: AbortSignal,
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
                failedAtCache,
                { now, resolutionTimeoutMs, failureBackoffMs },
                signal,
              );
              return { ...token, underlyingAddressOrDenom };
            } catch (error) {
              if (signal?.aborted) throw signal.reason ?? error;
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
  failedAtCache: Map<string, number>,
  options: {
    now: () => number;
    resolutionTimeoutMs: number;
    failureBackoffMs: number;
  },
  signal?: AbortSignal,
): Promise<string> {
  const key = `${token.chainName.toLowerCase()}:${token.addressOrDenom.toLowerCase()}`;
  const failedAt = failedAtCache.get(key);
  if (failedAt != null && options.now() - failedAt < options.failureBackoffMs) {
    throw new Error(`Vault collateral token resolution is backing off for ${token.chainName}`);
  }
  const cached = cache.get(key);
  if (cached) return waitForAbort(cached, signal);

  // Owner and rebase collateral routers share wrappedToken(). Cache the
  // in-flight promise so quote refreshes and concurrent quotes reuse it.
  const adapter = new EvmHypOwnerCollateralAdapter(token.chainName, multiProvider, {
    token: token.addressOrDenom,
  });
  const resolution = retryAsync(
    () => runWithTimeout(options.resolutionTimeoutMs, () => adapter.getWrappedTokenAddress()),
    3,
  )
    .then((address) => {
      failedAtCache.delete(key);
      return address.toLowerCase();
    })
    .catch((error) => {
      cache.delete(key);
      failedAtCache.set(key, options.now());
      throw error;
    });
  cache.set(key, resolution);
  return waitForAbort(resolution, signal);
}

function waitForAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason ?? new Error('Vault collateral token resolution aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function loadPublishedWarpRoutes(): Promise<RegistryWarpRouteMap> {
  const { warpRouteConfigs } = await import('@hyperlane-xyz/registry');
  return buildRegistryWarpRouteMap(warpRouteConfigs as Record<string, WarpCoreConfig>);
}
