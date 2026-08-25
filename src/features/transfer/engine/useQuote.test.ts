import { describe, expect, test } from 'vitest';

import type { RouteResponse } from '../../api/types';
import type { TransferFormValues } from './types';
import {
  augmentRoute,
  isQuoteFreshAfterResolution,
  isQuoteRequestReady,
  isQuoteSettledForSecurity,
  quoteExpiryDelayMs,
  validateRouteAmounts,
} from './useQuote';

function readyValues(overrides: Partial<TransferFormValues> = {}): TransferFormValues {
  return {
    srcChain: 1,
    dstChain: 2,
    srcToken: '0xToken',
    dstToken: '0xToken',
    amount: '1',
    recipient: '0xRecipient',
    slippageBps: 100,
    ...overrides,
  };
}

describe('isQuoteRequestReady', () => {
  const sender = '0xSender';

  test('is ready when sender and recipient are both present', () => {
    expect(isQuoteRequestReady(readyValues(), sender)).toBe(true);
  });

  test('is not ready without a sender', () => {
    expect(isQuoteRequestReady(readyValues(), undefined)).toBe(false);
  });

  test('is not ready when recipient is empty', () => {
    expect(isQuoteRequestReady(readyValues({ recipient: '' }), sender)).toBe(false);
  });

  test('becomes ready once a recipient is set', () => {
    const empty = readyValues({ recipient: '' });
    expect(isQuoteRequestReady(empty, sender)).toBe(false);
    expect(isQuoteRequestReady({ ...empty, recipient: '0xRecipient' }, sender)).toBe(true);
  });
});

describe('quoteExpiryDelayMs', () => {
  test('returns time remaining until quote expiry', () => {
    expect(quoteExpiryDelayMs(1_718_000_030, 1_718_000_000_000)).toBe(30_000);
  });

  test('clamps expired quotes to immediate timeout', () => {
    expect(quoteExpiryDelayMs(1_718_000_000, 1_718_000_030_000)).toBe(0);
  });
});

describe('isQuoteFreshAfterResolution', () => {
  test('requires the quote expiry safety margin after metadata resolution', () => {
    expect(isQuoteFreshAfterResolution(1_718_000_005, 1_718_000_000_000)).toBe(true);
    expect(isQuoteFreshAfterResolution(1_718_000_005, 1_718_000_000_001)).toBe(false);
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

  test('allows slippage across canonical source and destination swap legs', () => {
    expect(
      validateRouteAmounts(
        swapBridgeSwapRoute({
          output: '320016062708842',
          outputMin: '313647743060936',
        }),
        100,
      ),
    ).toEqual({ valid: true });
  });

  test('rejects non-canonical extra swap steps', () => {
    const route = swapBridgeSwapRoute() as RouteResponse;
    route.steps.splice(1, 0, {
      type: 'swap',
      chain: 56,
      dex: 'pancakeswap',
      tokenIn: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      tokenOut: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      amountIn: '600042771105985927',
      amountOut: '600042771105985927',
      path: [
        '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      ],
      poolCount: 1,
    });

    expect(validateRouteAmounts(route, 100)).toEqual({
      valid: false,
      reason: 'Route has too many swap steps',
    });
  });

  test('rejects canonical swap routes below compounded leg slippage', () => {
    expect(
      validateRouteAmounts(
        swapBridgeSwapRoute({
          output: '320016062708842',
          outputMin: '313647743060934',
        }),
        100,
      ),
    ).toEqual({
      valid: false,
      reason: 'Route minimum output is below slippage tolerance',
    });
  });

  test('rejects two swap steps without a bridge between them', () => {
    const base = swapRoute({ output: '100', outputMin: '98' });
    const step = base.steps[0];
    if (step.type !== 'swap') throw new Error('expected swap');
    const route = {
      ...base,
      steps: [
        ...base.steps,
        {
          ...step,
          tokenIn: '0x0000000000000000000000000000000000000002',
          tokenOut: '0x0000000000000000000000000000000000000003',
          path: [
            '0x0000000000000000000000000000000000000002',
            '0x0000000000000000000000000000000000000003',
          ],
        },
      ],
    } as RouteResponse;

    expect(validateRouteAmounts(route, 100)).toEqual({
      valid: false,
      reason: 'Route has multiple swap steps without a bridge',
    });
  });
});

describe('augmentRoute', () => {
  test('keeps embedded IGP visible without treating it as an extra debit', () => {
    const route = swapBridgeSwapRoute();
    const bridge = route.steps.find((step) => step.type === 'bridge');
    if (!bridge || bridge.type !== 'bridge') throw new Error('expected bridge step');
    bridge.fee.igpIncludedInAmountIn = true;
    bridge.fee.localNativeFee = '4118360';
    route.gas = { originGas: '0', destGas: '0' };

    expect(augmentRoute(route).feeBreakdown.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'igp',
          amount: 91576406884958n,
          includedInAmountIn: true,
        }),
        expect.objectContaining({
          category: 'network',
          amount: 4118360n,
        }),
      ]),
    );
  });
});

function swapRoute(overrides: { output?: string; outputMin?: string } = {}): RouteResponse {
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
  } as RouteResponse;
}

function swapBridgeSwapRoute(
  overrides: { output?: string; outputMin?: string } = {},
): RouteResponse {
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
          igpIncludedInAmountIn: false,
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
  } as RouteResponse;
}
