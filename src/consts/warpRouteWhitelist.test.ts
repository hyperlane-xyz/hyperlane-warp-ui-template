import {
  GithubRegistry,
  warpRouteConfigs as publishedWarpRouteConfigs,
} from '@hyperlane-xyz/registry';
import { WarpCoreConfig } from '@hyperlane-xyz/sdk';
import { objKeys } from '@hyperlane-xyz/utils';
import { assert, test } from 'vitest';
import { warpRouteWhitelist } from './warpRouteWhitelist';

test('warpRouteWhitelist', async () => {
  if (!warpRouteWhitelist) return;

  const registry = new GithubRegistry();
  let warpRouteConfigs: Record<string, WarpCoreConfig>;

  try {
    warpRouteConfigs = await registry.getWarpRoutes();
  } catch {
    warpRouteConfigs = publishedWarpRouteConfigs;
  }

  const uppercaseConfigKeys = new Set(objKeys(warpRouteConfigs).map((key) => key.toUpperCase()));
  for (const id of warpRouteWhitelist) {
    assert(uppercaseConfigKeys.has(id.toUpperCase()), `No route with id ${id} found in registry.`);
  }
});
