import { describe, expect, test } from 'vitest';

import type { BalanceToken } from './types';
import { getPriceImpactPercentage, getTotalFeeUsd, resolveCoinGeckoId } from './utils';

const TOKEN_ADDRESS = '0x1234567890123456789012345678901234567890';
const OTHER_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

function mockToken(overrides: Partial<BalanceToken>): BalanceToken {
  return {
    chainId: 1,
    address: TOKEN_ADDRESS,
    symbol: 'ETH',
    decimals: 18,
    isNative: false,
    chainName: 'ethereum',
    name: 'Ether',
    ...overrides,
  };
}

interface TestFeeComponent {
  category: string;
  amount: bigint;
  chainId: number;
  tokenAddress: string;
}

function component(overrides: Partial<TestFeeComponent>): TestFeeComponent {
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

describe('getPriceImpactPercentage', () => {
  test('returns the signed USD value change', () => {
    expect(getPriceImpactPercentage(100, 90)).toBeCloseTo(-10);
    expect(getPriceImpactPercentage(100, 105)).toBeCloseTo(5);
  });

  test('treats zero output as a complete loss', () => {
    expect(getPriceImpactPercentage(100, 0)).toBe(-100);
  });

  test('returns null when price impact is unavailable', () => {
    expect(getPriceImpactPercentage(null, 90)).toBeNull();
    expect(getPriceImpactPercentage(100, null)).toBeNull();
    expect(getPriceImpactPercentage(0, 0)).toBeNull();
    expect(getPriceImpactPercentage(Number.POSITIVE_INFINITY, 90)).toBeNull();
  });
});
