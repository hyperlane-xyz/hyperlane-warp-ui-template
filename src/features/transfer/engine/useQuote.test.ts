import { describe, expect, test } from 'vitest';

import { isQuoteSettledForSecurity, quoteExpiryDelayMs, validateRouteAmounts } from './useQuote';

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

describe('validateRouteAmounts', () => {
  test('rejects swap routes whose outputMin is below slippage tolerance', () => {
    expect(validateRouteAmounts(swapRoute({ outputMin: '0' }), 100)).toEqual({
      valid: false,
      reason: 'Route minimum output is below slippage tolerance',
    });
  });

  test('rejects routes whose output does not match the final step', () => {
    expect(validateRouteAmounts(swapRoute({ output: '200' }), 100)).toEqual({
      valid: false,
      reason: 'Route output does not match final step amount',
    });
  });
});

function swapRoute(overrides: { output?: string; outputMin?: string } = {}) {
  return {
    steps: [
      {
        type: 'swap' as const,
        chain: 1,
        dex: 'test',
        tokenIn: '0x0000000000000000000000000000000000000001',
        tokenOut: '0x0000000000000000000000000000000000000002',
        amountIn: '100',
        amountOut: '100',
        path: [
          '0x0000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000002',
        ],
        poolCount: 1,
      },
    ],
    output: overrides.output ?? '100',
    outputMin: overrides.outputMin ?? '99',
  } as never;
}
