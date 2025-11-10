import type { IRegistry } from '@hyperlane-xyz/registry';
import type { WarpCoreConfig } from '@hyperlane-xyz/sdk';
import { TokenStandard } from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../../consts/config.ts';
import { logger } from '../../../utils/logger.ts';
import { assembleWarpCoreConfig } from '../warpCoreConfig';

vi.mock('../../../consts/config.ts', () => ({
  config: {
    useOnlineRegistry: true,
    registryUrl: 'https://custom-registry',
  },
}));

vi.mock('../../../consts/warpRouteWhitelist.ts', () => ({
  warpRouteWhitelist: null,
}));

vi.mock('../../../consts/warpRoutes.ts', () => ({
  warpRouteConfigs: {
    tokens: [
      {
        chainName: 'ethereum',
        addressOrDenom: '0xABC',
        symbol: 'TS',
        name: 'TS Token',
        standard: TokenStandard.ERC20,
        decimals: 18,
      },
    ],
    options: {
      routeBlacklist: [{ origin: 'ts-origin', destination: 'ts-dest' }],
    },
  },
}));

vi.mock('../../../consts/warpRoutes.yaml', () => ({
  default: {
    tokens: [
      {
        chainName: 'polygon',
        addressOrDenom: '0xdef',
        symbol: 'YAML',
        name: 'YAML Token',
        standard: TokenStandard.ERC20,
        decimals: 6,
      },
    ],
    options: {
      interchainFeeConstants: [
        {
          origin: 'yaml-origin',
          destination: 'yaml-destination',
          amount: '5',
        },
      ],
    },
  },
}));

vi.mock('@hyperlane-xyz/registry', () => ({
  warpRouteConfigs: {
    routeFallback: {
      tokens: [
        {
          chainName: 'fallback',
          addressOrDenom: '0xfallback',
          symbol: 'FALL',
          name: 'Fallback Token',
          standard: TokenStandard.ERC20,
          decimals: 18,
        },
      ],
      options: {
        routeBlacklist: [{ origin: 'fallback-origin', destination: 'fallback-destination' }],
      },
    },
  },
}));

vi.mock('../../../utils/logger.ts', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('assembleWarpCoreConfig', () => {
  const registryWarpRoutes = {
    customRoute: {
      tokens: [
        {
          chainName: 'ethereum',
          addressOrDenom: '0xabc',
          symbol: 'REG',
          name: 'Registry Token',
          standard: TokenStandard.ERC20,
          decimals: 18,
        },
      ],
      options: {
        routeBlacklist: [{ origin: 'registry-origin', destination: 'registry-destination' }],
      },
    },
  };

  const storeOverrides: WarpCoreConfig[] = [
    {
      tokens: [
        {
          chainName: 'optimism',
          addressOrDenom: '0xghi',
          symbol: 'OVR',
          name: 'Override Token',
          standard: TokenStandard.ERC20,
          decimals: 6,
        },
      ],
      options: {
        routeBlacklist: [{ origin: 'store-origin', destination: 'store-destination' }],
        localFeeConstants: [
          {
            origin: 'store-origin',
            destination: 'store-destination',
            amount: '10',
          },
        ],
      },
    },
  ];

  let registry: IRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = {
      getWarpRoutes: vi.fn().mockResolvedValue(registryWarpRoutes),
    } as unknown as IRegistry;
    config.useOnlineRegistry = true;
    config.registryUrl = 'https://custom-registry';
  });

  it.skip('merges registry, static configs, and store overrides with deduped tokens', async () => {
    const result = await assembleWarpCoreConfig(storeOverrides, registry);

    expect(registry.getWarpRoutes).toHaveBeenCalledTimes(1);

    const tokenIds = result.tokens.map((t) => `${t.chainName}|${t.addressOrDenom?.toLowerCase()}`);
    expect(tokenIds).toEqual(
      expect.arrayContaining(['ethereum|0xabc', 'polygon|0xdef', 'optimism|0xghi']),
    );
    expect(tokenIds).toHaveLength(3);

    expect(result.options?.routeBlacklist ?? []).toEqual(
      expect.arrayContaining([
        { origin: 'registry-origin', destination: 'registry-destination' },
        { origin: 'store-origin', destination: 'store-destination' },
      ]),
    );
    expect(result.options?.localFeeConstants ?? []).toEqual(
      expect.arrayContaining([
        {
          origin: 'store-origin',
          destination: 'store-destination',
          amount: '10',
        },
      ]),
    );
    expect(result.options?.interchainFeeConstants ?? []).toEqual(
      expect.arrayContaining([
        {
          origin: 'yaml-origin',
          destination: 'yaml-destination',
          amount: '5',
        },
      ]),
    );
  });

  it.skip('skips registry fetch when useOnlineRegistry is false', async () => {
    config.useOnlineRegistry = false;

    const result = await assembleWarpCoreConfig(storeOverrides, registry);

    expect(registry.getWarpRoutes).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'Skipping registry warp routes (useOnlineRegistry is false)',
    );

    const tokenIds = result.tokens.map((t) => `${t.chainName}|${t.addressOrDenom?.toLowerCase()}`);
    expect(tokenIds).toEqual(
      expect.arrayContaining(['ethereum|0xabc', 'polygon|0xdef', 'optimism|0xghi']),
    );
  });

  it.skip('falls back to published registry routes when custom fetch fails', async () => {
    config.useOnlineRegistry = true;
    config.registryUrl = 'https://custom-registry';
    const failingRegistry = {
      getWarpRoutes: vi.fn().mockRejectedValue(new Error('network failure')),
    } as unknown as IRegistry;

    const result = await assembleWarpCoreConfig(storeOverrides, failingRegistry);

    const tokenIds = result.tokens.map((t) => `${t.chainName}|${t.addressOrDenom?.toLowerCase()}`);

    expect(tokenIds).toContain('fallback|0xfallback');
  });
});
