import { TokenConnectionType, TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';
import { describe, expect, test } from 'vitest';
import { dedupeTokens } from './warpCoreConfig';

describe('dedupeTokens', () => {
  test('merges duplicate token entries and unions connections', () => {
    const baseToken: WarpCoreConfig['tokens'][number] = {
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      decimals: 6,
      symbol: 'USDC',
      name: 'USDC',
      connections: [
        {
          type: TokenConnectionType.Hyperlane,
          token: 'ethereum|0x2222222222222222222222222222222222222222',
        },
      ],
    };
    const duplicateToken: WarpCoreConfig['tokens'][number] = {
      ...baseToken,
      name: 'USDC v2',
      connections: [
        {
          type: TokenConnectionType.Hyperlane,
          token: 'ethereum|0x3333333333333333333333333333333333333333',
        },
      ],
    };

    const deduped = dedupeTokens([baseToken, duplicateToken]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].name).toBe('USDC v2');
    expect(deduped[0].connections?.map((connection) => connection.token)).toEqual([
      'ethereum|0x2222222222222222222222222222222222222222',
      'ethereum|0x3333333333333333333333333333333333333333',
    ]);
  });

  test('dedupes identical connections by token id', () => {
    const token: WarpCoreConfig['tokens'][number] = {
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      decimals: 6,
      symbol: 'USDC',
      name: 'USDC',
      connections: [
        {
          type: TokenConnectionType.Hyperlane,
          token: 'ethereum|0x2222222222222222222222222222222222222222',
        },
      ],
    };

    const deduped = dedupeTokens([token, token]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].connections).toHaveLength(1);
  });
});
