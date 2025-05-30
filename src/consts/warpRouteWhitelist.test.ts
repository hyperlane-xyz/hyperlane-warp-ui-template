import { warpRouteConfigs } from '@hyperlane-xyz/registry';
import { objKeys } from '@hyperlane-xyz/utils';
import { assert, test } from 'vitest';
import { warpRouteWhitelist } from './warpRouteWhitelist';

test('warpRouteWhitelist', () => {
  if (!warpRouteWhitelist) return;

  const uppercaseConfigKeys = new Set(objKeys(warpRouteConfigs).map((key) => key.toUpperCase()));
  for (const id of warpRouteWhitelist) {
    assert(uppercaseConfigKeys.has(id.toUpperCase()), `No route with id ${id} found in registry.`);
  }
});
