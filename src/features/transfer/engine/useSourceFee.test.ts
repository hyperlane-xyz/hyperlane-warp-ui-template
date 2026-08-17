import { describe, expect, test } from 'vitest';

import type { RouteResponse } from '../../api/types';
import { sourceFeeRouteKey } from './useSourceFee';

describe('sourceFeeRouteKey', () => {
  test('uses stable primitives instead of the full route object', () => {
    const route = testRoute();
    const clone = structuredClone(route);

    expect(sourceFeeRouteKey(route)).toEqual(sourceFeeRouteKey(clone));
    expect(
      sourceFeeRouteKey(route).every(
        (part) => part == null || ['string', 'number', 'boolean'].includes(typeof part),
      ),
    ).toBe(true);
  });

  test('changes with fee-relevant route and transaction fields', () => {
    const route = testRoute();
    const changedAmount = structuredClone(route);
    changedAmount.steps[0]!.amountIn = '2000';
    const changedValue = structuredClone(route);
    if (changedValue.tx && 'value' in changedValue.tx) changedValue.tx.value = '5';
    const changedPath = structuredClone(route);
    if (changedPath.steps[0]?.type === 'swap') changedPath.steps[0].dex = 'other-dex';

    expect(sourceFeeRouteKey(changedAmount)).not.toEqual(sourceFeeRouteKey(route));
    expect(sourceFeeRouteKey(changedValue)).not.toEqual(sourceFeeRouteKey(route));
    expect(sourceFeeRouteKey(changedPath)).not.toEqual(sourceFeeRouteKey(route));
  });

  test('ignores refresh-only output and calldata changes', () => {
    const route = testRoute();
    const refreshed = structuredClone(route);
    refreshed.output = '899';
    refreshed.outputMin = '889';
    if (refreshed.tx && 'data' in refreshed.tx) refreshed.tx.data = '0xabcd';

    expect(sourceFeeRouteKey(refreshed)).toEqual(sourceFeeRouteKey(route));
  });
});

function testRoute(): RouteResponse {
  const tx = { to: 'router', data: '0x1234', value: '0' };
  return {
    steps: [
      {
        type: 'swap',
        chain: 1,
        dex: 'test-dex',
        tokenIn: 'token-in',
        tokenOut: 'token-out',
        amountIn: '1000',
        amountOut: '900',
        path: ['token-in', 'token-out'],
        poolCount: 1,
      },
    ],
    output: '900',
    outputMin: '890',
    executionKind: 'universalRouter',
    connection: null,
    gas: { originGas: '200000', destGas: '0' },
    tx,
    txs: [tx],
    approval: null,
  };
}
