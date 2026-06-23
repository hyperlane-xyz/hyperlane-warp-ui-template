import { describe, expect, test } from 'vitest';

import { quoteExpiryDelayMs } from './useQuote';

describe('quoteExpiryDelayMs', () => {
  test('returns time remaining until quote expiry', () => {
    expect(quoteExpiryDelayMs(1_718_000_030, 1_718_000_000_000)).toBe(30_000);
  });

  test('clamps expired quotes to immediate timeout', () => {
    expect(quoteExpiryDelayMs(1_718_000_000, 1_718_000_030_000)).toBe(0);
  });
});
