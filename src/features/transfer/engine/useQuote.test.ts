import { describe, expect, test } from 'vitest';

import { isQuoteSettledForSecurity, quoteExpiryDelayMs } from './useQuote';

describe('quoteExpiryDelayMs', () => {
  test('returns time remaining until quote expiry', () => {
    expect(quoteExpiryDelayMs(1_718_000_030, 1_718_000_000_000)).toBe(30_000);
  });

  test('clamps expired quotes to immediate timeout', () => {
    expect(quoteExpiryDelayMs(1_718_000_000, 1_718_000_030_000)).toBe(0);
  });
});

describe('isQuoteSettledForSecurity', () => {
  test('keeps successful quotes unsettled until security context settles', () => {
    expect(isQuoteSettledForSecurity(true, false, false)).toBe(false);
  });

  test('settles successful quotes when security context is ready or failed', () => {
    expect(isQuoteSettledForSecurity(true, false, true)).toBe(true);
  });

  test('settles quote errors without waiting for security context', () => {
    expect(isQuoteSettledForSecurity(false, true, false)).toBe(true);
  });
});
