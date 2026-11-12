import { describe, expect, test } from 'vitest';

import { formatDisplayAmount, formatTokenAmount } from './amount';

describe('formatTokenAmount', () => {
  test('retains full precision alongside the compact display', () => {
    expect(formatTokenAmount('1600000000000123', 18)).toEqual({
      display: '0.0016',
      full: '0.001600000000000123',
    });
  });

  test.each([18, undefined])('preserves legacy decimal amounts with decimals %s', (decimals) => {
    expect(formatTokenAmount('1.5', decimals)).toEqual({ display: '1.5', full: '1.5' });
  });

  test('labels atomic units when decimals are unknown', () => {
    expect(formatTokenAmount('12345', undefined)).toEqual({
      display: '12345 (atomic)',
      full: '12345 (atomic)',
    });
    expect(formatTokenAmount('0', 18)).toEqual({ display: '0', full: '0' });
  });
});

describe('formatDisplayAmount', () => {
  test('converts atomic units with token decimals before truncating', () => {
    expect(formatDisplayAmount(1234567n, 6)).toBe('1.2345');
    expect(formatDisplayAmount(123456789123456000000n, 18)).toBe('123.4567');
  });

  test('caps normal fractional values at available token decimals', () => {
    expect(formatDisplayAmount(12345n, 2)).toBe('123.45');
    expect(formatDisplayAmount(123456n, 3)).toBe('123.456');
  });

  test('drops sub-display dust for non-zero integer amounts', () => {
    expect(formatDisplayAmount(1000000000000000001n, 18)).toBe('1');
  });

  test('formats zero amounts', () => {
    expect(formatDisplayAmount(0n, 18)).toBe('0');
  });

  test('keeps enough precision for tiny non-zero values', () => {
    expect(formatDisplayAmount(12345678900000n, 18)).toBe('0.00001234');
    expect(formatDisplayAmount(123456789n, 18)).toBe('0.0000000001234');
    expect(formatDisplayAmount(1n, 18)).toBe('0.000000000000000001');
  });
});
