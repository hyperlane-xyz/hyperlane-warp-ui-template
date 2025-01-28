import { warpRouteConfigs } from '@hyperlane-xyz/registry';
import { assert, test } from 'vitest';
import { warpRouteWhitelist } from './warpRouteWhitelist';

test('warpRouteWhitelist', () => {
  if (!warpRouteWhitelist) return;
  for (const id of warpRouteWhitelist) {
    assert(warpRouteConfigs[id], `No route with id ${id} found in registry.`);
  }
});
