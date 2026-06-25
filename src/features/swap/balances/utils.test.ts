import { describe, expect, test } from 'vitest';

import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';
import type { FeeComponent } from '../types';
import { getTotalFeeUsd, resolveCoinGeckoId } from './utils';

const TOKEN_ADDRESS = '0x1234567890123456789012345678901234567890';
const OTHER_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

function mockToken(overrides: Partial<UiToken>): UiToken {
  return {
    chainId: 1,
    address: TOKEN_ADDRESS,
    symbol: 'ETH',
    decimals: 18,
    isNative: false,
    isBridgeToken: false,
    isPoolToken: false,
    canBridge: true,
    canSwap: true,
    bridgeSymbols: [],
    warpRouteIds: [],
    chainName: 'ethereum',
    name: 'Ether',
    addressOrDenom: TOKEN_ADDRESS,
    ...overrides,
  };
}

function component(overrides: Partial<FeeComponent>): FeeComponent {
  return {
    category: 'igp',
    amount: 1n,
    chainId: 1,
    tokenAddress: TOKEN_ADDRESS,
    ...overrides,
  };
}

describe('resolveCoinGeckoId', () => {
  test('resolves coinGeckoId and decimals by chain/token key', () => {
    const tokenMap = new Map([
      [`1-${TOKEN_ADDRESS}`, mockToken({ coinGeckoId: 'ethereum', decimals: 18 })],
    ]);

    expect(resolveCoinGeckoId(component({}), tokenMap)).toEqual({
      coinGeckoId: 'ethereum',
      decimals: 18,
    });
  });

  test('resolves EVM fee token addresses case-insensitively', () => {
    const mixedCaseAddress = OTHER_ADDRESS.toUpperCase().replace('0X', '0x');
    const token = mockToken({
      address: mixedCaseAddress,
      coinGeckoId: 'ethereum',
      decimals: 18,
    });
    const tokenMap = new Map([[getTokenKey(token), token]]);

    expect(resolveCoinGeckoId(component({ tokenAddress: OTHER_ADDRESS }), tokenMap)).toEqual({
      coinGeckoId: 'ethereum',
      decimals: 18,
    });
  });

  test('resolves case-sensitive fee token addresses exactly', () => {
    const solanaAddress = 'Es9vMFrzaCER';
    const token = mockToken({
      chainId: 1399811149,
      address: solanaAddress,
      coinGeckoId: 'tether',
      decimals: 6,
    });
    const tokenMap = new Map([[getTokenKey(token), token]]);

    expect(
      resolveCoinGeckoId(component({ chainId: 1399811149, tokenAddress: solanaAddress }), tokenMap),
    ).toEqual({
      coinGeckoId: 'tether',
      decimals: 6,
    });
  });

  test('defaults decimals to 18 when token metadata is missing', () => {
    expect(resolveCoinGeckoId(component({}), new Map())).toEqual({
      coinGeckoId: undefined,
      decimals: 18,
    });
  });
});

describe('getTotalFeeUsd', () => {
  test('sums all priced fee components', () => {
    const tokenMap = new Map([
      [`1-${TOKEN_ADDRESS}`, mockToken({ coinGeckoId: 'ethereum', decimals: 18 })],
      [
        `1-${OTHER_ADDRESS}`,
        mockToken({ address: OTHER_ADDRESS, coinGeckoId: 'usdc', decimals: 6 }),
      ],
    ]);

    const total = getTotalFeeUsd(
      [
        component({ amount: 10n ** 16n }), // 0.01 ETH * $2,000 = $20
        component({ amount: 5_000_000n, tokenAddress: OTHER_ADDRESS }), // 5 USDC * $1 = $5
      ],
      tokenMap,
      { ethereum: 2000, usdc: 1 },
    );

    expect(total).toBeCloseTo(25);
  });

  test('returns null when any component has no coinGeckoId', () => {
    const tokenMap = new Map([[`1-${TOKEN_ADDRESS}`, mockToken({ coinGeckoId: 'ethereum' })]]);

    const total = getTotalFeeUsd(
      [component({}), component({ tokenAddress: OTHER_ADDRESS })],
      tokenMap,
      { ethereum: 2000 },
    );

    expect(total).toBeNull();
  });

  test('returns null when any component has no price', () => {
    const tokenMap = new Map([
      [`1-${TOKEN_ADDRESS}`, mockToken({ coinGeckoId: 'ethereum' })],
      [
        `1-${OTHER_ADDRESS}`,
        mockToken({ address: OTHER_ADDRESS, coinGeckoId: 'usdc', decimals: 6 }),
      ],
    ]);

    const total = getTotalFeeUsd(
      [component({}), component({ tokenAddress: OTHER_ADDRESS })],
      tokenMap,
      { ethereum: 2000 },
    );

    expect(total).toBeNull();
  });

  test('converts large bigint amounts through fromWei before pricing', () => {
    const tokenMap = new Map([
      [`1-${TOKEN_ADDRESS}`, mockToken({ coinGeckoId: 'ethereum', decimals: 18 })],
    ]);

    const total = getTotalFeeUsd([component({ amount: 1234567890123456789012345n })], tokenMap, {
      ethereum: 2,
    });

    expect(total).toBeCloseTo(2469135.7802469134);
  });
});
