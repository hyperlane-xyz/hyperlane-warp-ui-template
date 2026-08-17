import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test, vi } from 'vitest';

import type { RouteResponse } from '../../api/types';
import { NATIVE_ADDRESS } from './routeFunding';
import type { AugmentedQuote } from './types';
import { calculateNativeMaxAmount } from './useNativeMax';

describe('calculateNativeMaxAmount', () => {
  test('runs quote then fee estimation and reserves source gas', async () => {
    const calls: string[] = [];
    const route = nativeRoute(1_000n);
    const quoteForAmount = vi.fn(async (amount: bigint) => {
      calls.push(`quote:${amount}`);
      return augmentedQuote(route);
    });
    const estimateSourceFee = vi.fn(async () => {
      calls.push('fee');
      return 10n;
    });

    await expect(
      calculateNativeMaxAmount({
        balance: 1_000n,
        originChainId: 1,
        originProtocol: ProtocolType.Ethereum,
        sourceTokenAddress: NATIVE_ADDRESS,
        quoteForAmount,
        estimateSourceFee,
      }),
    ).resolves.toBe(990n);
    expect(calls).toEqual(['quote:1000', 'fee']);
  });

  test('does not subtract embedded native IGP from Max a second time', async () => {
    await expect(
      calculateNativeMaxAmount({
        balance: 1_000n,
        originChainId: 1,
        originProtocol: ProtocolType.Ethereum,
        sourceTokenAddress: NATIVE_ADDRESS,
        quoteForAmount: async () => augmentedQuote(nativeBridgeRoute()),
        estimateSourceFee: async () => 10n,
      }),
    ).resolves.toBe(990n);
  });

  test('also reserves native value paid on top of an origin swap', async () => {
    const route = nativeRoute(1_007n);

    await expect(
      calculateNativeMaxAmount({
        balance: 1_000n,
        originChainId: 1,
        originProtocol: ProtocolType.Ethereum,
        sourceTokenAddress: NATIVE_ADDRESS,
        quoteForAmount: async () => augmentedQuote(route),
        estimateSourceFee: async () => 10n,
      }),
    ).resolves.toBe(983n);
  });
});

function nativeRoute(txValue: bigint): RouteResponse {
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

function nativeBridgeRoute(): RouteResponse {
  return {
    steps: [
      {
        type: 'bridge',
        chain: 1,
        destChain: 10,
        asset: NATIVE_ADDRESS,
        router: '0x1111111111111111111111111111111111111111',
        amountIn: '1000',
        amountOut: '767',
        fee: {
          tokenFee: '0',
          igpToken: NATIVE_ADDRESS,
          igpAmount: '233',
          igpIncludedInAmountIn: true,
          localNativeFee: '0',
        },
      },
    ],
    output: '767',
    outputMin: '767',
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

function augmentedQuote(route: RouteResponse): AugmentedQuote {
  return {
    raw: { routes: [route], expiresAt: 1 },
    expiresAt: 1,
    routes: [
      {
        raw: route,
        hasFixedOutput: false,
        feeBreakdown: { components: [], originGas: 200_000n, destGas: 0n },
      },
    ],
  };
}
