import type { IRegistry } from '@hyperlane-xyz/registry';
import { EvmHypOwnerCollateralAdapter, type MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { RouteResponse } from '../api/types';
import {
  createQuotedVaultCollateralTokenResolver,
  loadRegistryWarpRoutes,
} from './registryWarpRoutes';

const ROUTER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const QUOTED_ROUTER = '0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD';
const UNTRUSTED_ROUTER = '0x9999999999999999999999999999999999999999';
const VAULT = '0xbeef047a543e45807105e51a8bbefcc5950fcfba';
const UNDERLYING = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const MIXED_CASE_UNDERLYING = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn() } }));

vi.mock('@hyperlane-xyz/registry', () => ({
  warpRouteConfigs: {
    'TEST/fallback': {
      tokens: [{ chainName: 'ethereum', addressOrDenom: ROUTER, standard: 'EvmHypCollateral' }],
    },
  },
}));

beforeEach(() => vi.restoreAllMocks());

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

describe('resolveQuotedVaultCollateralTokens', () => {
  test('retries transient failures when resolving the vault underlying token', async () => {
    const getWrappedTokenAddress = vi
      .spyOn(EvmHypOwnerCollateralAdapter.prototype, 'getWrappedTokenAddress')
      .mockRejectedValueOnce(new Error('RPC unavailable'))
      .mockResolvedValue(UNDERLYING);
    const multiProvider = {
      getChainName: vi.fn(() => 'ethereum'),
      getEthersV5Provider: vi.fn(() => ({ _isProvider: true })),
    } as unknown as MultiProtocolProvider;

    const resolve = createQuotedVaultCollateralTokenResolver();
    const routes = await resolve(vaultRoutes(), [quotedRoute()], multiProvider);

    expect(routes['usdt/ethereum-igra'].tokens[0]).toMatchObject({
      collateralAddressOrDenom: VAULT,
      underlyingAddressOrDenom: UNDERLYING,
    });
    expect(getWrappedTokenAddress).toHaveBeenCalledTimes(2);
  });

  test('only resolves vault tokens used by the quote', async () => {
    const getWrappedTokenAddress = vi
      .spyOn(EvmHypOwnerCollateralAdapter.prototype, 'getWrappedTokenAddress')
      .mockResolvedValue(UNDERLYING);
    const resolve = createQuotedVaultCollateralTokenResolver();
    const routes = await resolve(
      vaultRoutes(),
      [quotedRoute({ warpRouteId: 'TEST/non-vault' })],
      multiProvider(),
    );

    expect(routes['usdt/ethereum-igra'].tokens[0].underlyingAddressOrDenom).toBeUndefined();
    expect(getWrappedTokenAddress).not.toHaveBeenCalled();
  });

  test('does not resolve a quote router that does not match the registry', async () => {
    const getWrappedTokenAddress = vi
      .spyOn(EvmHypOwnerCollateralAdapter.prototype, 'getWrappedTokenAddress')
      .mockResolvedValue(UNDERLYING);
    const resolve = createQuotedVaultCollateralTokenResolver();

    await resolve(vaultRoutes(), [quotedRoute({ router: UNTRUSTED_ROUTER })], multiProvider());

    expect(getWrappedTokenAddress).not.toHaveBeenCalled();
  });

  test('uses the registry router address for the wrapped token call', async () => {
    const getWrappedTokenAddress = vi
      .spyOn(EvmHypOwnerCollateralAdapter.prototype, 'getWrappedTokenAddress')
      .mockImplementation(function (this: EvmHypOwnerCollateralAdapter) {
        expect(this.addresses.token).toBe(ROUTER);
        return Promise.resolve(MIXED_CASE_UNDERLYING);
      });
    const resolve = createQuotedVaultCollateralTokenResolver();

    const routes = await resolve(vaultRoutes(), [quotedRoute()], multiProvider());

    expect(getWrappedTokenAddress).toHaveBeenCalledTimes(1);
    expect(routes['usdt/ethereum-igra'].tokens[0].underlyingAddressOrDenom).toBe(UNDERLYING);
  });

  test('caches successful resolutions across quotes', async () => {
    const getWrappedTokenAddress = vi
      .spyOn(EvmHypOwnerCollateralAdapter.prototype, 'getWrappedTokenAddress')
      .mockResolvedValue(UNDERLYING);
    const resolve = createQuotedVaultCollateralTokenResolver();

    await resolve(vaultRoutes(), [quotedRoute()], multiProvider());
    const routes = await resolve(vaultRoutes(), [quotedRoute()], multiProvider());

    expect(routes['usdt/ethereum-igra'].tokens[0].underlyingAddressOrDenom).toBe(UNDERLYING);
    expect(getWrappedTokenAddress).toHaveBeenCalledTimes(1);
  });

  test('backs off after failure before retrying on a later quote', async () => {
    let now = 1_000;
    const getWrappedTokenAddress = vi
      .spyOn(EvmHypOwnerCollateralAdapter.prototype, 'getWrappedTokenAddress')
      .mockRejectedValueOnce(new Error('RPC unavailable'))
      .mockRejectedValueOnce(new Error('RPC unavailable'))
      .mockRejectedValueOnce(new Error('RPC unavailable'))
      .mockResolvedValue(UNDERLYING);
    const resolve = createQuotedVaultCollateralTokenResolver({
      now: () => now,
      failureBackoffMs: 100,
    });

    const failed = await resolve(vaultRoutes(), [quotedRoute()], multiProvider());
    const backedOff = await resolve(vaultRoutes(), [quotedRoute()], multiProvider());
    now += 101;
    const recovered = await resolve(vaultRoutes(), [quotedRoute()], multiProvider());

    expect(failed['usdt/ethereum-igra'].tokens[0].underlyingAddressOrDenom).toBeUndefined();
    expect(backedOff['usdt/ethereum-igra'].tokens[0].underlyingAddressOrDenom).toBeUndefined();
    expect(recovered['usdt/ethereum-igra'].tokens[0].underlyingAddressOrDenom).toBe(UNDERLYING);
    expect(getWrappedTokenAddress).toHaveBeenCalledTimes(4);
  });

  test('bounds a stalled underlying token resolution', async () => {
    const getWrappedTokenAddress = vi
      .spyOn(EvmHypOwnerCollateralAdapter.prototype, 'getWrappedTokenAddress')
      .mockImplementation(() => new Promise(() => {}));
    const resolve = createQuotedVaultCollateralTokenResolver({ resolutionTimeoutMs: 1 });

    const routes = await resolve(vaultRoutes(), [quotedRoute()], multiProvider());

    expect(routes['usdt/ethereum-igra'].tokens[0].underlyingAddressOrDenom).toBeUndefined();
    expect(getWrappedTokenAddress).toHaveBeenCalledTimes(3);
  });

  test('lets one quote abort without cancelling a shared resolution', async () => {
    let release!: (value: string) => void;
    const resolution = new Promise<string>((resolve) => {
      release = resolve;
    });
    const getWrappedTokenAddress = vi
      .spyOn(EvmHypOwnerCollateralAdapter.prototype, 'getWrappedTokenAddress')
      .mockReturnValue(resolution);
    const resolve = createQuotedVaultCollateralTokenResolver();
    const controller = new AbortController();

    const aborted = resolve(vaultRoutes(), [quotedRoute()], multiProvider(), controller.signal);
    const shared = resolve(vaultRoutes(), [quotedRoute()], multiProvider());
    controller.abort(new Error('quote changed'));

    await expect(aborted).rejects.toThrow('quote changed');
    release(MIXED_CASE_UNDERLYING);
    await expect(shared).resolves.toMatchObject({
      'usdt/ethereum-igra': {
        tokens: [{ underlyingAddressOrDenom: UNDERLYING }],
      },
    });
    expect(getWrappedTokenAddress).toHaveBeenCalledTimes(1);
  });
});

function vaultRoutes() {
  return {
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
    'test/non-vault': {
      id: 'TEST/non-vault',
      tokens: [
        {
          chainName: 'ethereum',
          addressOrDenom: ROUTER,
          standard: 'EvmHypCollateral',
        },
      ],
    },
  };
}

function multiProvider(): MultiProtocolProvider {
  return {
    getChainName: vi.fn(() => 'ethereum'),
    getEthersV5Provider: vi.fn(() => ({ _isProvider: true })),
  } as unknown as MultiProtocolProvider;
}

function quotedRoute({
  router = QUOTED_ROUTER,
  warpRouteId = 'USDT/ethereum-igra',
}: {
  router?: string;
  warpRouteId?: string;
} = {}): RouteResponse {
  return {
    connection: null,
    steps: [
      {
        type: 'bridge',
        chain: 1,
        destChain: 2,
        asset: UNDERLYING,
        router,
        amountIn: '1',
        amountOut: '1',
        fee: {
          tokenFee: '0',
          igpToken: '0x0000000000000000000000000000000000000000',
          igpAmount: '0',
          localNativeFee: '0',
        },
        bridgeSymbol: 'USDT',
        warpRouteId,
      },
    ],
  } as RouteResponse;
}

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
