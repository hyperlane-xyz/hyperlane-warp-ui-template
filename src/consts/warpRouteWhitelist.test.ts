import {
  GithubRegistry,
  warpRouteConfigs as publishedWarpRouteConfigs,
} from '@hyperlane-xyz/registry';
import { WarpCoreConfig } from '@hyperlane-xyz/sdk';
import { objKeys } from '@hyperlane-xyz/utils';
import { assert, test } from 'vitest';
import { config } from './config';
import { warpRouteWhitelist } from './warpRouteWhitelist';

test('warpRouteWhitelist', async () => {
  if (!warpRouteWhitelist) return;

  const registry = new GithubRegistry({
    uri: config.registryUrl,
    branch: config.registryBranch,
    proxyUrl: config.registryProxyUrl,
  });
  let warpRouteConfigs: Record<string, WarpCoreConfig> = {};

  try {
    const routeEntries = await Promise.all(
      warpRouteWhitelist.map(
        async (routeId): Promise<[string, WarpCoreConfig | null]> => [
          routeId,
          await registry.getWarpRoute(routeId),
        ],
      ),
    );
    warpRouteConfigs = routeEntries.reduce<Record<string, WarpCoreConfig>>((acc, item) => {
      const [routeId, routeConfig] = item;
      if (routeConfig) acc[routeId] = routeConfig;
      return acc;
    }, {});
  } catch {
    warpRouteConfigs = publishedWarpRouteConfigs;
  }

  const uppercaseConfigKeys = new Set(objKeys(warpRouteConfigs).map((key) => key.toUpperCase()));
  for (const id of warpRouteWhitelist) {
    assert(uppercaseConfigKeys.has(id.toUpperCase()), `No route with id ${id} found in registry.`);
  }
});
