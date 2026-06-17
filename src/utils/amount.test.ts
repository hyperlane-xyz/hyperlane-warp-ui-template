import { describe, expect, test } from 'vitest';

import { formatDisplayAmount, formatInputAmount, formatUsd } from './amount';

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

describe('formatInputAmount', () => {
  test('formats exact input values without display rounding', () => {
    expect(formatInputAmount(123456789123456789n, 18)).toBe('0.123456789123456789');
    expect(formatInputAmount(123456700n, 6)).toBe('123.4567');
  });

  test('keeps tiny non-zero amounts non-zero', () => {
    expect(formatInputAmount(1n, 18)).toBe('0.000000000000000001');
  });

  test('formats zero-decimal amounts', () => {
    expect(formatInputAmount(123n, 0)).toBe('123');
  });

  test('rejects invalid token decimals', () => {
    expect(() => formatInputAmount(123n, -1)).toThrow('Invalid token decimals');
    expect(() => formatInputAmount(123n, 256)).toThrow('Invalid token decimals');
    expect(() => formatInputAmount(123n, 1.5)).toThrow('Invalid token decimals');
  });
});

describe('formatUsd', () => {
  test('formats finite USD values', () => {
    expect(formatUsd(12.3)).toBe('$12.30');
    expect(formatUsd(12.3, true)).toBe('≈$12.30');
    expect(formatUsd(0.001)).toBe('<$0.01');
  });

  test('falls back for invalid USD values', () => {
    expect(formatUsd(Number.NaN)).toBe('-');
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe('-');
    expect(formatUsd(-1)).toBe('-');
  });
});
