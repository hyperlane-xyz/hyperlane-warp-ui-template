import { describe, expect, test } from 'vitest';

import { computeDestAmount } from './scaleUtils';

describe('computeDestAmount', () => {
  test('returns null when either token is undefined', () => {
    const token = { decimals: 18, scale: 10 };
    expect(computeDestAmount('1', undefined, token)).toBeNull();
    expect(computeDestAmount('1', token, undefined)).toBeNull();
    expect(computeDestAmount('1', undefined, undefined)).toBeNull();
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
    // origin scale=10, dest scale=1, both 18 decimals
    // 1 origin token → message = 1e18 * 10 = 1e19
    // dest local = 1e19 / 1 = 1e19 → 10 tokens
    const origin = { decimals: 18, scale: 10 };
    const dest = { decimals: 18, scale: 1 };
    expect(computeDestAmount('1', origin, dest)).toBe('10');
  });

  test('computes dest amount for scale-down route (BSC USDT style)', () => {
    // origin: 18 decimals, scale {1, 1e12} (scale-down)
    // dest: 6 decimals, no scale (identity)
    // 1 origin token → origin wei = 1e18
    // message = 1e18 * 1 / 1e12 = 1e6
    // dest local = 1e6 * 1 / 1 = 1e6 → 1 in 6 decimals
    const origin = { decimals: 18, scale: { numerator: 1, denominator: 1_000_000_000_000 } };
    const dest = { decimals: 6 };
    expect(computeDestAmount('1', origin, dest)).toBe('1');
  });

  test('computes dest amount for scale-up route', () => {
    // origin: 6 decimals, scale 1e12 (scale-up)
    // dest: 18 decimals, no scale (identity)
    // 1 origin token → origin wei = 1e6
    // message = 1e6 * 1e12 = 1e18
    // dest local = 1e18 → 1 in 18 decimals
    const origin = { decimals: 6, scale: 1_000_000_000_000 };
    const dest = { decimals: 18 };
    expect(computeDestAmount('1', origin, dest)).toBe('1');
  });

  test('computes dest amount when only dest has scale', () => {
    // origin: 6 decimals, no scale (identity)
    // dest: 18 decimals, scale {1, 1e12} (scale-down)
    // 1 origin token → origin wei = 1e6
    // message = 1e6 * 1 / 1 = 1e6
    // dest local = 1e6 * 1e12 / 1 = 1e18 → 1 in 18 decimals
    const origin = { decimals: 6 };
    const dest = { decimals: 18, scale: { numerator: 1, denominator: 1_000_000_000_000 } };
    expect(computeDestAmount('1', origin, dest)).toBe('1');
  });

  test('handles fractional amounts', () => {
    const origin = { decimals: 18, scale: 10 };
    const dest = { decimals: 18, scale: 1 };
    expect(computeDestAmount('0.5', origin, dest)).toBe('5');
  });
});
