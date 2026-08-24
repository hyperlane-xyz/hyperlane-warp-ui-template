import type { IRegistry } from '@hyperlane-xyz/registry';
import { EvmHypOwnerCollateralAdapter, type MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { describe, expect, test, vi } from 'vitest';

import { loadRegistryWarpRoutes, resolveRegistryVaultCollateralTokens } from './registryWarpRoutes';

const ROUTER = '0x1111111111111111111111111111111111111111';
const VAULT = '0xbEef047a543E45807105E51A8BBEFCc5950fcfBa';
const UNDERLYING = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

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

  test('falls back to package warp routes when registry routes build to an empty map', async () => {
    const routes = await loadRegistryWarpRoutes(
      registry({
        'TEST/malformed': {
          tokens: [{ chainName: 'ethereum', standard: 'EvmHypCollateral' }],
        },
      }),
    );

    expect(routes['test/fallback']).toMatchObject({
      id: 'TEST/fallback',
      tokens: [{ chainName: 'ethereum', addressOrDenom: ROUTER }],
    });
  });
});

describe('resolveRegistryVaultCollateralTokens', () => {
  test('resolves the underlying token from a vault collateral router', async () => {
    vi.spyOn(EvmHypOwnerCollateralAdapter.prototype, 'getWrappedTokenAddress').mockResolvedValue(
      UNDERLYING,
    );
    const multiProvider = {
      getEthersV5Provider: vi.fn(() => ({ _isProvider: true })),
    } as unknown as MultiProtocolProvider;

    const routes = await resolveRegistryVaultCollateralTokens(
      {
        'usdt/ethereum-igra': {
          id: 'USDT/ethereum-igra',
          tokens: [
            {
              chainName: 'ethereum',
              addressOrDenom: ROUTER,
              collateralAddressOrDenom: VAULT,
              standard: 'EvmHypOwnerCollateral',
            },
          ],
        },
      },
      multiProvider,
    );

    expect(routes['usdt/ethereum-igra'].tokens[0]).toMatchObject({
      collateralAddressOrDenom: VAULT,
      underlyingAddressOrDenom: UNDERLYING,
    });
  });
});

function registry(routes: Record<string, { tokens: Record<string, string>[] }>): IRegistry {
  return { getWarpRoutes: async () => routes } as unknown as IRegistry;
}

function failingRegistry(): IRegistry {
  return {
    getWarpRoutes: async () => {
      throw new Error('registry unavailable');
    },
  } as unknown as IRegistry;
}
