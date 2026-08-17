import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import type { RouteResponse } from '../../api/types';
import { feeKey, getSourceFunding, NATIVE_ADDRESS } from './routeFunding';

describe('getSourceFunding', () => {
  test('does not add embedded EVM native IGP on top of amountIn', () => {
    const funding = getSourceFunding({
      route: bridgeRoute({ igpAmount: 233n, igpIncludedInAmountIn: true }),
      originChainId: 1,
      originProtocol: ProtocolType.Ethereum,
      sourceTokenAddress: NATIVE_ADDRESS,
      sourceTokenIsNative: true,
      fallbackAmountIn: 1_000n,
    });

    expect(funding.sourceTokenRequired).toBe(1_000n);
    expect(funding.nativeRequired).toBe(1_000n);
  });

  test('keeps separately funded non-EVM native IGP on top', () => {
    const funding = getSourceFunding({
      route: bridgeRoute({ igpAmount: 100n, igpIncludedInAmountIn: false }),
      originChainId: 1,
      originProtocol: ProtocolType.Sealevel,
      sourceTokenAddress: NATIVE_ADDRESS,
      sourceTokenIsNative: true,
      fallbackAmountIn: 1_000n,
    });

    expect(funding.sourceTokenRequired).toBe(1_100n);
    expect(funding.nativeRequired).toBe(1_100n);
  });

  test('uses transaction value for native funding added by an origin swap', () => {
    const funding = getSourceFunding({
      route: swapRoute(1_007n),
      originChainId: 1,
      originProtocol: ProtocolType.Ethereum,
      sourceTokenAddress: NATIVE_ADDRESS,
      sourceTokenIsNative: true,
      fallbackAmountIn: 1_000n,
    });

    expect(funding.nativeRequired).toBe(1_007n);
  });

  test('sums native value across a multi-transaction route', () => {
    const route = swapRoute(4n);
    route.txs = [route.tx!, { ...route.tx!, value: '6' }];

    const funding = getSourceFunding({
      route,
      originChainId: 1,
      originProtocol: ProtocolType.Ethereum,
      sourceTokenAddress: 'token',
      sourceTokenIsNative: false,
      fallbackAmountIn: 1_000n,
    });

    expect(funding.nativeRequired).toBe(10n);
  });

  test('groups fees by chain instead of charging later-chain fees at origin', () => {
    const route = bridgeRoute({ igpAmount: 100n, igpIncludedInAmountIn: false });
    const bridge = route.steps[0];
    if (bridge.type !== 'bridge') throw new Error('Expected bridge');
    route.steps.push({
      ...bridge,
      chain: 10,
      destChain: 42161,
      fee: { ...bridge.fee, igpAmount: '200' },
    });

    const funding = getSourceFunding({
      route,
      originChainId: 1,
      originProtocol: ProtocolType.Sealevel,
      sourceTokenAddress: NATIVE_ADDRESS,
      sourceTokenIsNative: true,
      fallbackAmountIn: 1_000n,
    });

    expect(funding.nativeRequired).toBe(1_100n);
    expect(funding.externalFees.get(feeKey(10, NATIVE_ADDRESS))).toBe(200n);
  });
});

function bridgeRoute({
  igpAmount,
  igpIncludedInAmountIn,
}: {
  igpAmount: bigint;
  igpIncludedInAmountIn: boolean;
}): RouteResponse {
  return {
    steps: [
      {
        type: 'bridge',
        chain: 1,
        destChain: 10,
        asset: NATIVE_ADDRESS,
        router: '0x1111111111111111111111111111111111111111',
        amountIn: '1000',
        amountOut: (1_000n - igpAmount).toString(),
        fee: {
          tokenFee: '0',
          igpToken: NATIVE_ADDRESS,
          igpAmount: igpAmount.toString(),
          igpIncludedInAmountIn,
          localNativeFee: '0',
        },
      },
    ],
    output: (1_000n - igpAmount).toString(),
    outputMin: (1_000n - igpAmount).toString(),
    executionKind: 'universalRouter',
    connection: null,
    gas: { originGas: '200000', destGas: '0' },
    tx: {
      to: '0x2222222222222222222222222222222222222222',
      data: '0x',
      value: '1000',
    },
    txs: [],
    approval: null,
  };
}

function swapRoute(txValue: bigint): RouteResponse {
  return {
    steps: [
      {
        type: 'swap',
        chain: 1,
        dex: 'test',
        tokenIn: NATIVE_ADDRESS,
        tokenOut: '0x1111111111111111111111111111111111111111',
        amountIn: '1000',
        amountOut: '900',
        path: [NATIVE_ADDRESS, '0x1111111111111111111111111111111111111111'],
        poolCount: 1,
      },
    ],
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
