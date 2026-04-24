import { describe, expect, test } from 'vitest';

import { computeDestAmount, formatMessageAmount } from './scaleUtils';

describe('computeDestAmount', () => {
  test('returns null when either token is null or undefined', () => {
    const token = { decimals: 18, scale: 10 };
    expect(computeDestAmount('1', null, token)).toBeNull();
    expect(computeDestAmount('1', token, null)).toBeNull();
    expect(computeDestAmount('1', undefined, token)).toBeNull();
    expect(computeDestAmount('1', token, undefined)).toBeNull();
  });

  test('returns null when both tokens have no scale', () => {
    const origin = { decimals: 18 };
    const dest = { decimals: 6 };
    expect(computeDestAmount('1', origin, dest)).toBeNull();
  });

  test('returns null when scales are equal', () => {
    const origin = { decimals: 18, scale: 10 };
    const dest = { decimals: 18, scale: 10 };
    expect(computeDestAmount('1', origin, dest)).toBeNull();
  });

  test('returns null when scales are equivalent fractions', () => {
    const origin = { decimals: 18, scale: { numerator: 2, denominator: 4 } };
    const dest = { decimals: 18, scale: { numerator: 1, denominator: 2 } };
    expect(computeDestAmount('1', origin, dest)).toBeNull();
  });

  test('computes dest amount for same-decimal different-scale (VRA-style)', () => {
    const origin = { decimals: 18, scale: 10 };
    const dest = { decimals: 18, scale: 1 };
    expect(computeDestAmount('1', origin, dest)).toBe('10');
  });

  test('computes dest amount for scale-down route (BSC USDT style)', () => {
    const origin = { decimals: 18, scale: { numerator: 1, denominator: 1_000_000_000_000 } };
    const dest = { decimals: 6 };
    expect(computeDestAmount('1', origin, dest)).toBe('1');
  });

  test('computes dest amount for scale-up route', () => {
    const origin = { decimals: 6, scale: 1_000_000_000_000 };
    const dest = { decimals: 18 };
    expect(computeDestAmount('1', origin, dest)).toBe('1');
  });

  test('computes dest amount when only dest has scale', () => {
    const origin = { decimals: 6 };
    const dest = { decimals: 18, scale: { numerator: 1, denominator: 1_000_000_000_000 } };
    expect(computeDestAmount('1', origin, dest)).toBe('1');
  });

  test('computes dest amount with bigint scale values', () => {
    const origin = { decimals: 18, scale: { numerator: 1n, denominator: 1_000_000_000_000n } };
    const dest = { decimals: 6 };
    expect(computeDestAmount('1', origin, dest)).toBe('1');
  });

  test('handles fractional amounts', () => {
    const origin = { decimals: 18, scale: 10 };
    const dest = { decimals: 18, scale: 1 };
    expect(computeDestAmount('0.5', origin, dest)).toBe('5');
  });
});

describe('formatMessageAmount', () => {
  const emptyRouterMap = {};

  test('uses localAmountFromMessage for tokens with scale', () => {
    // BSC USDT: 18 decimals, scale {1, 1e12}
    // Message amount 1000000 (1 USDT in 6-dec message space)
    // Local = 1000000 * 1e12 / 1 = 1e18 → "1" in 18 decimals
    const token = {
      decimals: 18,
      scale: { numerator: 1, denominator: 1_000_000_000_000 },
    };
    expect(formatMessageAmount('1000000', token, emptyRouterMap, 'bsc')).toBe('1');
  });

  test('converts message amount using numeric scale (VRA-style)', () => {
    // VRA: ETH scale=1, BSC scale=10
    // Message amount 10e18 (10 VRA in message space with scale=10)
    // Local = 10e18 / 10 = 1e18 → "1" in 18 decimals
    const token = { decimals: 18, scale: 10 };
    expect(formatMessageAmount('10000000000000000000', token, {}, 'bsc')).toBe('1');
  });

  test('falls back to wireDecimals for tokens without scale', () => {
    const token = { decimals: 6, addressOrDenom: '0xabc' };
    const routerMap = { eth: { '0xabc': { wireDecimals: 6 } } };
    // 1000000 in 6 decimals = 1
    expect(formatMessageAmount('1000000', token, routerMap, 'eth')).toBe('1');
  });

  test('falls back to token.decimals when no routerInfo', () => {
    const token = { decimals: 6, addressOrDenom: '0xabc' };
    expect(formatMessageAmount('1000000', token, emptyRouterMap, 'eth')).toBe('1');
  });
});
