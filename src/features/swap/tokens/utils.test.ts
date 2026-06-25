import { describe, expect, test } from 'vitest';

import type { UiToken } from './types';
import { getTokenByChainAndAddress, getTokenKey } from './utils';

function createUiToken(args: Partial<UiToken> = {}): UiToken {
  return {
    chainId: 1,
    address: '0x1111111111111111111111111111111111111111',
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
    isBridgeToken: false,
    isPoolToken: true,
    canBridge: false,
    canSwap: true,
    bridgeSymbols: [],
    warpRouteIds: [],
    chainName: 'ethereum',
    name: 'USD Coin',
    addressOrDenom: '0x1111111111111111111111111111111111111111',
    ...args,
  };
}

describe('getTokenKey', () => {
  test('preserves engine token address casing', () => {
    expect(getTokenKey(createUiToken({ chainId: 1399811149, address: 'Es9vMFrzaCER' }))).toBe(
      '1399811149-Es9vMFrzaCER',
    );
  });

  test('normalizes valid EVM token addresses', () => {
    expect(
      getTokenKey(
        createUiToken({
          chainId: 8453,
          address: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
        }),
      ),
    ).toBe('8453-0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
  });
});

describe('getTokenByChainAndAddress', () => {
  test('resolves exact case-sensitive token addresses', () => {
    const token = createUiToken({ chainId: 1399811149, address: 'Es9vMFrzaCER' });
    const tokenMap = new Map([[getTokenKey(token), token]]);

    expect(getTokenByChainAndAddress(tokenMap, 1399811149, 'Es9vMFrzaCER')).toBe(token);
  });

  test('does not match non-EVM addresses with different casing', () => {
    const token = createUiToken({ chainId: 1399811149, address: 'Es9vMFrzaCER' });
    const tokenMap = new Map([[getTokenKey(token), token]]);

    expect(getTokenByChainAndAddress(tokenMap, 1399811149, 'es9vmfrzacer')).toBeUndefined();
  });

  test('falls back to case-insensitive matching for EVM addresses', () => {
    const token = createUiToken({
      chainId: 8453,
      address: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
    });
    const tokenMap = new Map([[getTokenKey(token), token]]);

    expect(
      getTokenByChainAndAddress(tokenMap, 8453, '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'),
    ).toBe(token);
  });
});
