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

  test('rejects multi-swap routes below the total user slippage floor', () => {
    expect(
      validateRouteAmounts(
        swapBridgeSwapRoute({
          output: '320016062708842',
          outputMin: '313647743060936',
        }),
        100,
      ),
    ).toEqual({
      valid: false,
      reason: 'Route minimum output is below slippage tolerance',
    });
  });

  test('accepts multi-swap routes at the total user slippage floor', () => {
    expect(
      validateRouteAmounts(
        swapBridgeSwapRoute({
          output: '320016062708842',
          outputMin: '316815902081753',
        }),
        100,
      ),
    ).toEqual({ valid: true });
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

function swapBridgeSwapRoute(overrides: { output?: string; outputMin?: string } = {}) {
  return {
    steps: [
      {
        type: 'swap' as const,
        chain: 56,
        dex: 'pancakeswap',
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        tokenOut: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        amountIn: '1000000000000000',
        amountOut: '600042771105985927',
        path: [
          '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
          '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        ],
        poolCount: 1,
      },
      {
        type: 'bridge' as const,
        chain: 56,
        destChain: 8453,
        asset: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        router: '0x1eebF9d94a5E707E30f18b9aB3295D963C111fb7',
        amountIn: '600042771105985927',
        amountOut: '599952',
        fee: {
          tokenFee: '89992916728388',
          igpToken: '0x0000000000000000000000000000000000000000',
          igpAmount: '91576406884958',
          localNativeFee: '0',
        },
        bridgeSymbol: 'USDC',
        warpRouteId: 'USDC/eclipsemainnet',
      },
      {
        type: 'swap' as const,
        chain: 8453,
        dex: 'aerodrome',
        tokenIn: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        tokenOut: '0x4200000000000000000000000000000000000006',
        amountIn: '599952',
        amountOut: overrides.output ?? '320016062708842',
        path: [
          '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          '0x4200000000000000000000000000000000000006',
        ],
        poolCount: 1,
      },
    ],
    output: overrides.output ?? '320016062708842',
    outputMin: overrides.outputMin ?? '313647743060936',
  } as never;
}
