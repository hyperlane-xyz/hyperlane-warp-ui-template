import type { IRegistry } from '@hyperlane-xyz/registry';
import { describe, expect, test, vi } from 'vitest';

import { loadRegistryWarpRoutes } from './registryWarpRoutes';

const ROUTER = '0x1111111111111111111111111111111111111111';
type MockWarpRoutes = Record<
  string,
  { tokens: { chainName: string; addressOrDenom: string; standard: string }[] }
>;

vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn() } }));

vi.mock('@hyperlane-xyz/registry', () => ({
  warpRouteConfigs: {
    'TEST/fallback': {
      tokens: [{ chainName: 'ethereum', addressOrDenom: ROUTER, standard: 'EvmHypCollateral' }],
    },
  },
}));

describe('loadRegistryWarpRoutes', () => {
  test('uses registry warp routes when available', async () => {
    const routes = await loadRegistryWarpRoutes(
      registry({
        'TEST/live': {
          tokens: [{ chainName: 'ethereum', addressOrDenom: ROUTER, standard: 'EvmHypCollateral' }],
        },
      }),
    );

    expect(routes['test/live']?.id).toBe('TEST/live');
    expect(routes['test/fallback']).toBeUndefined();
  });

  test('falls back to package warp routes when registry loading fails', async () => {
    const routes = await loadRegistryWarpRoutes(failingRegistry());

    expect(routes['test/fallback']).toMatchObject({
      id: 'TEST/fallback',
      tokens: [{ chainName: 'ethereum', addressOrDenom: ROUTER }],
    });
  });

  test('falls back to package warp routes when registry returns no routes', async () => {
    const routes = await loadRegistryWarpRoutes(registry({}));

    expect(routes['test/fallback']).toMatchObject({
      id: 'TEST/fallback',
      tokens: [{ chainName: 'ethereum', addressOrDenom: ROUTER }],
    });
  });
});

function registry(routes: MockWarpRoutes): IRegistry {
  return { getWarpRoutes: async () => routes } as unknown as IRegistry;
}

function failingRegistry(): IRegistry {
  return {
    getWarpRoutes: async () => {
      throw new Error('registry unavailable');
    },
  } as unknown as IRegistry;
}
