import { ProtocolType } from '@hyperlane-xyz/utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { RouteResponse } from '../../api/types';
import type { UiToken } from '../../tokens/types';
import { NATIVE_ADDRESS } from './routeFunding';
import type { AugmentedQuote } from './types';
import { calculateNativeMaxAmount, useNativeMax } from './useNativeMax';

const hookMocks = vi.hoisted(() => ({
  formikContext: vi.fn(),
  setLoading: vi.fn(),
}));

vi.mock('formik', () => ({ useFormikContext: hookMocks.formikContext }));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: (callback: unknown) => callback,
    useEffect: vi.fn(),
    useRef: (initialValue: unknown) => ({ current: initialValue }),
    useState: () => [false, hookMocks.setLoading],
  };
});

beforeEach(() => {
  hookMocks.formikContext.mockReset();
  hookMocks.setLoading.mockReset();
});

test('keeps the existing input until the final native Max amount is ready', async () => {
  const setFieldValue = vi.fn().mockResolvedValue(undefined);
  hookMocks.formikContext.mockReturnValue({
    values: { amount: '123' },
    setFieldError: vi.fn(),
    setFieldValue,
  });
  const sourceFee = deferred<bigint>();
  const quoteForAmount = vi.fn(async () => augmentedQuote(nativeRoute(1_000n)));
  const estimateSourceFee = vi.fn(() => sourceFee.promise);
  const max = useNativeMax({
    intentKey: 'intent',
    originChainId: 1,
    originProtocol: ProtocolType.Ethereum,
    quoteForAmount,
    estimateSourceFee,
  });

  const pending = max.onMax(1_000n, nativeToken());
  await vi.waitFor(() => expect(estimateSourceFee).toHaveBeenCalledOnce());

  expect(setFieldValue).not.toHaveBeenCalled();
  sourceFee.resolve(10n);
  await pending;

  expect(setFieldValue).toHaveBeenCalledOnce();
  expect(setFieldValue).toHaveBeenCalledWith('amount', '990', false);
});

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

function nativeToken(): UiToken {
  return {
    chainId: 1,
    address: NATIVE_ADDRESS,
    symbol: 'ETH',
    decimals: 0,
    isNative: true,
    isBridgeToken: true,
    isPoolToken: false,
    canBridge: true,
    canSwap: true,
    bridgeSymbols: ['ETH'],
    warpRouteIds: ['test'],
    chainName: 'ethereum',
    name: 'Ether',
    addressOrDenom: NATIVE_ADDRESS,
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
