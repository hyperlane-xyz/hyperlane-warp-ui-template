import { describe, expect, test } from 'vitest';

import { getPriceImpactPercentage } from '../../balances/utils';
import { isPriceImpactTooHigh } from './priceImpact';

describe('isPriceImpactTooHigh', () => {
  test('blocks losses at or above 10%', () => {
    expect(isPriceImpactTooHigh(-10)).toBe(true);
    expect(isPriceImpactTooHigh(-25)).toBe(true);
  });

  test('allows losses below 10% and positive impact', () => {
    expect(isPriceImpactTooHigh(-9.99)).toBe(false);
    expect(isPriceImpactTooHigh(5)).toBe(false);
  });

  test('allows transfers when price impact is unavailable', () => {
    expect(isPriceImpactTooHigh(null)).toBe(false);
  });

  test('blocks when the executable minimum crosses the threshold', () => {
    const expectedImpact = getPriceImpactPercentage(100, 91);
    const minimumImpact = getPriceImpactPercentage(100, 88.27);

    expect(isPriceImpactTooHigh(expectedImpact)).toBe(false);
    expect(isPriceImpactTooHigh(minimumImpact)).toBe(true);
  });
});
