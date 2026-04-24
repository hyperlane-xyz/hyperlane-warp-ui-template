import { TokenStandard } from '@hyperlane-xyz/sdk';
import { describe, expect, test } from 'vitest';

import { dedupeTokens, NullableAddressWarpCoreToken } from './warpCoreConfig';

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
