import { describe, expect, test } from 'vitest';

import type { UiToken } from './types';
import { getTokenKey } from './utils';

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
});
