import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import type { RouteResponse } from '../../api/types';
import {
  calculateNativeMaxInput,
  getRouteInputAmount,
  shouldCalculateNativeMax,
} from './nativeMax';

describe('native Max', () => {
  test('reserves only source gas when native bridge IGP is embedded', () => {
    const route = testRoute({ stepType: 'bridge', amountIn: 1_000n, txValue: 1_000n });

    expect(
      calculateNativeMaxInput({
        balance: 1_000n,
        route,
        gasCost: 10n,
        originProtocol: ProtocolType.Ethereum,
      }),
    ).toBe(990n);
  });

  test('also reserves native value paid on top after an origin swap', () => {
    const route = testRoute({ stepType: 'swap', amountIn: 1_000n, txValue: 1_007n });

    expect(
      calculateNativeMaxInput({
        balance: 1_000n,
        route,
        gasCost: 10n,
        originProtocol: ProtocolType.Ethereum,
      }),
    ).toBe(983n);
  });

  test('returns zero when the native reserve consumes the balance', () => {
    const route = testRoute({ stepType: 'bridge', amountIn: 5n, txValue: 5n });

    expect(
      calculateNativeMaxInput({
        balance: 5n,
        route,
        gasCost: 5n,
        originProtocol: ProtocolType.Ethereum,
      }),
    ).toBe(0n);
  });

  test('reserves separately funded native IGP on non-EVM routes', () => {
    const route = testRoute({
      stepType: 'bridge',
      amountIn: 1_000n,
      txValue: 1_000n,
      igpIncludedInAmountIn: false,
    });

    expect(
      calculateNativeMaxInput({
        balance: 1_000n,
        route,
        gasCost: 10n,
        originProtocol: ProtocolType.Sealevel,
      }),
    ).toBe(890n);
  });

  test('does not reserve fees paid on later route chains', () => {
    const route = testRoute({
      stepType: 'bridge',
      amountIn: 1_000n,
      txValue: 1_000n,
      igpIncludedInAmountIn: false,
    });
    const originBridge = route.steps[0];
    if (originBridge.type !== 'bridge') throw new Error('Expected bridge test step');
    route.steps.push({
      ...originBridge,
      chain: 10,
      destChain: 42161,
      fee: { ...originBridge.fee, igpAmount: '200' },
    });

    expect(
      calculateNativeMaxInput({
        balance: 1_000n,
        route,
        gasCost: 10n,
        originProtocol: ProtocolType.Sealevel,
      }),
    ).toBe(890n);
  });

  test('reads input from native swaps and bridges', () => {
    expect(getRouteInputAmount(testRoute({ stepType: 'swap', amountIn: 9n, txValue: 9n }))).toBe(
      9n,
    );
    expect(
      getRouteInputAmount(testRoute({ stepType: 'bridge', amountIn: 11n, txValue: 11n })),
    ).toBe(11n);
  });

  test('enables two-stage Max for native origin tokens on every protocol', () => {
    expect(shouldCalculateNativeMax(true)).toBe(true);
    expect(shouldCalculateNativeMax(false)).toBe(false);
  });
});

function testRoute({
  stepType,
  amountIn,
  txValue,
  igpIncludedInAmountIn = true,
}: {
  stepType: 'swap' | 'bridge';
  amountIn: bigint;
  txValue: bigint;
  igpIncludedInAmountIn?: boolean;
}): RouteResponse {
  const step =
    stepType === 'swap'
      ? {
          type: 'swap' as const,
          chain: 1,
          dex: 'test',
          tokenIn: '0x0000000000000000000000000000000000000000',
          tokenOut: '0x1111111111111111111111111111111111111111',
          amountIn: amountIn.toString(),
          amountOut: '900',
          path: [
            '0x0000000000000000000000000000000000000000',
            '0x1111111111111111111111111111111111111111',
          ],
          poolCount: 1,
        }
      : {
          type: 'bridge' as const,
          chain: 1,
          destChain: 10,
          asset: '0x0000000000000000000000000000000000000000',
          router: '0x1111111111111111111111111111111111111111',
          amountIn: amountIn.toString(),
          amountOut: '900',
          fee: {
            tokenFee: '0',
            igpToken: '0x0000000000000000000000000000000000000000',
            igpAmount: '100',
            igpIncludedInAmountIn,
            localNativeFee: '0',
          },
        };

  return {
    steps: [step],
    output: '900',
    outputMin: '900',
    executionKind: 'universalRouter',
    connection: null,
    gas: { originGas: '200000', destGas: '0' },
    tx: {
      to: '0x2222222222222222222222222222222222222222',
      data: '0x',
      value: txValue.toString(),
    },
    txs: [],
    approval: null,
  };
}
