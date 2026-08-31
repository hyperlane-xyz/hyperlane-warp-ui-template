import { describe, expect, test } from 'vitest';

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
});
