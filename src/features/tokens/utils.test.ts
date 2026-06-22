import { describe, expect, test } from 'vitest';

import { isBridgeOnlyToken } from './hooks';
import type { UiToken } from './types';
import { mergeRouteTokensFirst, tokenKey } from './utils';

describe('tokenKey', () => {
  test('lowercases EVM addresses', () => {
    expect(tokenKey(1, '0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48')).toBe(
      '1-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
  });

  test('preserves non-EVM token casing', () => {
    expect(tokenKey(101, 'So11111111111111111111111111111111111111112')).toBe(
      '101-So11111111111111111111111111111111111111112',
    );
  });
});

describe('mergeRouteTokensFirst', () => {
  test('prepends route tokens and dedupes matching catalogue tokens', () => {
    const routeToken = token(8453, '0x1111111111111111111111111111111111111111', 'base');
    const normalToken = token(1, '0x2222222222222222222222222222222222222222', 'ethereum');

    expect(mergeRouteTokensFirst([routeToken], [normalToken, { ...routeToken }])).toEqual([
      routeToken,
      normalToken,
    ]);
  });

  test('preserves non-EVM token casing while deduping', () => {
    const routeToken = token(101, 'So11111111111111111111111111111111111111112', 'solana');

    expect(mergeRouteTokensFirst([routeToken], [{ ...routeToken }])).toEqual([routeToken]);
  });
});

describe('isBridgeOnlyToken', () => {
  test('requires bridge support without swap support', () => {
    expect(isBridgeOnlyToken(token(1, '0x1111111111111111111111111111111111111111', 'base'))).toBe(
      true,
    );
    expect(
      isBridgeOnlyToken(
        token(1, '0x1111111111111111111111111111111111111111', 'base', { canSwap: true }),
      ),
    ).toBe(false);
    expect(
      isBridgeOnlyToken(
        token(1, '0x1111111111111111111111111111111111111111', 'base', {
          canBridge: false,
          isBridgeToken: false,
        }),
      ),
    ).toBe(false);
  });
});

function token(
  chainId: number,
  address: string,
  chainName: string,
  overrides: Partial<UiToken> = {},
): UiToken {
  return {
    chainId,
    address,
    chainName,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    isBridgeToken: true,
    isPoolToken: false,
    canBridge: true,
    canSwap: false,
    bridgeSymbols: ['USDC'],
    warpRouteIds: ['USDC/base'],
    addressOrDenom: address,
    ...overrides,
  };
}
