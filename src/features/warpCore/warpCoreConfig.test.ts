import { TokenStandard, WarpCore, WarpCoreConfig, getTokenConnectionId } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import {
  NullableAddressWarpCoreToken,
  dedupeTokens,
  filterAleoTokensByNetwork,
  reduceOptions,
} from './warpCoreConfig';

// The WarpCoreConfig['options'] schema currently only declares array-valued fields,
// but reduceOptions handles arbitrary keys (registry/yaml/store configs may add their own).
// Cast the looser test shapes through unknown to exercise all three branches.
type Options = WarpCoreConfig['options'];
const opts = (o: Record<string, unknown>): Options => o as unknown as Options;

const makeToken = (
  overrides: Partial<NullableAddressWarpCoreToken>,
): NullableAddressWarpCoreToken =>
  ({
    decimals: 6,
    name: 'Mock',
    ...overrides,
  }) as NullableAddressWarpCoreToken;

describe('dedupeTokens', () => {
  test('should dedupe non-M0 tokens by chainName|addressOrDenom', () => {
    // Two identical IBC token definitions (same address, same chain) — merge into one.
    const t1 = makeToken({
      chainName: 'neutron',
      symbol: 'USDC',
      standard: TokenStandard.CosmosIbc,
      addressOrDenom: 'ibc/ABC',
    });
    const t2 = makeToken({
      chainName: 'neutron',
      symbol: 'USDC',
      standard: TokenStandard.CosmosIbc,
      addressOrDenom: 'ibc/ABC',
    });

    expect(dedupeTokens([t1, t2])).toHaveLength(1);
  });

  test('should keep non-M0 tokens with different addressOrDenom distinct', () => {
    const t1 = makeToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
    });
    const t2 = makeToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
    });

    expect(dedupeTokens([t1, t2])).toHaveLength(2);
  });

  test('should NOT merge EvmM0Portal tokens sharing addressOrDenom but different symbols', () => {
    // wM, USDSC, USDnr all use the same ethereum portal contract but wrap different collaterals
    const M0_HUB = '0xD925C84b55E4e44a53749fF5F2a5A13F63D128fd';
    const wm = makeToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: '0x437cc33344a0B27A429f795ff6B469C72698B291',
      warpRouteId: 'wM/wrapped-m',
    });
    const usdsc = makeToken({
      chainName: 'ethereum',
      symbol: 'USDSC',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: '0x3f99231dD03a9F0E7e3421c92B7b90fbe012985a',
      warpRouteId: 'USDSC/usdsc',
    });
    const usdnr = makeToken({
      chainName: 'ethereum',
      symbol: 'USDnr',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: '0xD48e565561416dE59DA1050ED70b8d75e8eF28f9',
      warpRouteId: 'USDnr/usdnr',
    });

    const result = dedupeTokens([wm, usdsc, usdnr]);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.symbol).sort()).toEqual(['USDSC', 'USDnr', 'wM']);
  });

  test('should NOT merge EvmM0PortalLite tokens sharing addressOrDenom but different symbols', () => {
    // wM Lite and mUSD share the same bsc portal-lite contract
    const M0_LITE = '0x36f586A30502AE3afb555b8aA4dCc05d233c2ecE';
    const wmLite = makeToken({
      chainName: 'bsc',
      symbol: 'wM',
      standard: TokenStandard.EvmM0PortalLite,
      addressOrDenom: M0_LITE,
      collateralAddressOrDenom: '0x437cc33344a0B27A429f795ff6B469C72698B291',
      warpRouteId: 'wM/wrapped-m-portal-lite',
    });
    const musd = makeToken({
      chainName: 'bsc',
      symbol: 'mUSD',
      standard: TokenStandard.EvmM0PortalLite,
      addressOrDenom: M0_LITE,
      collateralAddressOrDenom: '0xaca92e438df0b2401ff60da7e4337b687a2435da',
      warpRouteId: 'mUSD/musd',
    });

    const result = dedupeTokens([wmLite, musd]);
    expect(result).toHaveLength(2);
  });

  test('should still merge M0Portal duplicates with same chainName+symbol+addressOrDenom', () => {
    // Identical wM entries (e.g. fetched from registry and also from yaml) should merge
    const wm1 = makeToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: '0xD925C84b55E4e44a53749fF5F2a5A13F63D128fd',
      collateralAddressOrDenom: '0x437cc33344a0B27A429f795ff6B469C72698B291',
    });
    const wm2 = makeToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: '0xD925C84b55E4e44a53749fF5F2a5A13F63D128fd',
      collateralAddressOrDenom: '0x437cc33344a0B27A429f795ff6B469C72698B291',
    });

    expect(dedupeTokens([wm1, wm2])).toHaveLength(1);
  });

  test('should keep M0Portal Hub and PortalLite variants distinct on same chain (different addresses)', () => {
    // wM on ethereum exists in both wrapped-m (Hub) and wrapped-m-portal-lite (Lite) configs
    const wmHub = makeToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: '0xD925C84b55E4e44a53749fF5F2a5A13F63D128fd',
      collateralAddressOrDenom: '0x437cc33344a0B27A429f795ff6B469C72698B291',
    });
    const wmLite = makeToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0PortalLite,
      addressOrDenom: '0x36f586A30502AE3afb555b8aA4dCc05d233c2ecE',
      collateralAddressOrDenom: '0x437cc33344a0B27A429f795ff6B469C72698B291',
    });

    const result = dedupeTokens([wmHub, wmLite]);
    expect(result).toHaveLength(2);
  });

  test('should handle mix of M0 and non-M0 tokens', () => {
    const ibc = makeToken({
      chainName: 'neutron',
      symbol: 'USDC',
      standard: TokenStandard.CosmosIbc,
      addressOrDenom: 'ibc/ABC',
    });
    const ibcDup = makeToken({
      chainName: 'neutron',
      symbol: 'USDC',
      standard: TokenStandard.CosmosIbc,
      addressOrDenom: 'ibc/ABC',
    });
    const wm = makeToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: '0xD925C84b55E4e44a53749fF5F2a5A13F63D128fd',
    });
    const usdsc = makeToken({
      chainName: 'ethereum',
      symbol: 'USDSC',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: '0xD925C84b55E4e44a53749fF5F2a5A13F63D128fd',
    });

    const result = dedupeTokens([ibc, ibcDup, wm, usdsc]);
    // IBC merged to 1, wM + USDSC stay as 2 → 3 total
    expect(result).toHaveLength(3);
  });
});

describe('filterAleoTokensByNetwork', () => {
  const ETH_ADDR = '0x1111111111111111111111111111111111111111';
  const ALEO_ADDR = 'aleo1usdc';
  const ALEO_TESTNET_ADDR = 'aleo1usdctest';

  const makeAleoConfig = (): NullableAddressWarpCoreToken[] => [
    makeToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      name: 'USD Coin',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ETH_ADDR,
      connections: [
        { token: getTokenConnectionId(ProtocolType.Aleo, 'aleo', ALEO_ADDR) },
        { token: getTokenConnectionId(ProtocolType.Aleo, 'aleotestnet', ALEO_TESTNET_ADDR) },
      ],
    }),
    makeToken({
      chainName: 'aleo',
      symbol: 'USDC',
      name: 'USD Coin',
      standard: TokenStandard.AleoHypSynthetic,
      addressOrDenom: ALEO_ADDR,
      connections: [{ token: getTokenConnectionId(ProtocolType.Ethereum, 'ethereum', ETH_ADDR) }],
    }),
    makeToken({
      chainName: 'aleotestnet',
      symbol: 'USDC',
      name: 'USD Coin',
      standard: TokenStandard.AleoHypSynthetic,
      addressOrDenom: ALEO_TESTNET_ADDR,
      connections: [{ token: getTokenConnectionId(ProtocolType.Ethereum, 'ethereum', ETH_ADDR) }],
    }),
  ];

  test.each(['mainnet', 'testnet'] as const)(
    'keeps only the %s Aleo chain, prunes dangling connections, and WarpCore.FromConfig does not throw',
    (aleoNetwork) => {
      const kept = aleoNetwork === 'mainnet' ? 'aleo' : 'aleotestnet';
      const excluded = aleoNetwork === 'mainnet' ? 'aleotestnet' : 'aleo';

      const filtered = filterAleoTokensByNetwork(makeAleoConfig(), aleoNetwork);

      expect(filtered.map((t) => t.chainName).sort()).toEqual(['ethereum', kept].sort());

      const ethToken = filtered.find((t) => t.chainName === 'ethereum')!;
      expect(ethToken.connections).toHaveLength(1);
      expect(ethToken.connections!.some((c) => c.token.includes(`|${excluded}|`))).toBe(false);
      expect(ethToken.connections!.some((c) => c.token.includes(`|${kept}|`))).toBe(true);

      // Regression check for the bug the reviewer caught: WarpCore.FromConfig asserts
      // every connection target resolves to a token in the list, so a dangling
      // connection to the excluded chain would throw 'Connected token not found'.
      expect(() =>
        WarpCore.FromConfig(
          {} as never,
          {
            tokens: filtered,
            options: {},
          } as unknown as WarpCoreConfig,
        ),
      ).not.toThrow();
    },
  );
});

describe('reduceOptions', () => {
  test('concatenates array-valued options across configs', () => {
    const a = opts({
      interchainFeeConstants: [{ origin: 'ethereum', destination: 'arbitrum', amount: 1n }],
    });
    const b = opts({
      interchainFeeConstants: [{ origin: 'arbitrum', destination: 'ethereum', amount: 2n }],
    });

    const result = reduceOptions([a, b]) as any;
    expect(result.interchainFeeConstants).toHaveLength(2);
    expect(result.interchainFeeConstants[0].origin).toBe('ethereum');
    expect(result.interchainFeeConstants[1].origin).toBe('arbitrum');
  });

  test('deep-merges object-valued options last-wins (does not clobber nested keys)', () => {
    const a = opts({ sealevel: { altAddresses: { eclipsemainnet: '0xAAA' } } });
    const b = opts({ sealevel: { altAddresses: { solanamainnet: '0xBBB' } } });

    const result = reduceOptions([a, b]) as any;
    expect(result.sealevel.altAddresses).toEqual({
      eclipsemainnet: '0xAAA',
      solanamainnet: '0xBBB',
    });
  });

  test('last-write wins for scalar option values', () => {
    const a = opts({ relayerUrl: 'https://first.example' });
    const b = opts({ relayerUrl: 'https://second.example' });

    const result = reduceOptions([a, b]) as any;
    expect(result.relayerUrl).toBe('https://second.example');
  });

  test('handles inconsistent shapes across configs without throwing', () => {
    // First config writes an array; second writes an object at the same key.
    // The object branch should not spread the array as {0: ..., 1: ...}.
    const a = opts({ feature: [1, 2] });
    const b = opts({ feature: { enabled: true } });

    const result = reduceOptions([a, b]) as any;
    expect(result.feature).toEqual({ enabled: true });
  });

  test('ignores nullish incoming scalars instead of overwriting prior value', () => {
    const a = opts({ relayerUrl: 'https://first.example' });
    const b = opts({ relayerUrl: null });

    const result = reduceOptions([a, b]) as any;
    expect(result.relayerUrl).toBe('https://first.example');
  });

  test('returns empty options object when given empty list', () => {
    expect(reduceOptions([])).toEqual({});
  });

  test('skips undefined entries in the options list', () => {
    const a = opts({ interchainFeeConstants: [{ origin: 'a', destination: 'b', amount: 1n }] });

    const result = reduceOptions([a, undefined]) as any;
    expect(result.interchainFeeConstants).toHaveLength(1);
  });
});
