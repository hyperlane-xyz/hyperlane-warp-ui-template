import { ChainDisabledReason, ChainStatus } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ChainDiscovery, RouteResponse } from '../../api/types';
import type { UiToken } from '../../tokens/types';
import type { AugmentedRoute } from './types';
import { validateBalances, validateChains, validateQuote } from './validate';

const { readBalanceMock, estimateNativeGasCostMock } = vi.hoisted(() => ({
  readBalanceMock: vi.fn(),
  estimateNativeGasCostMock: vi.fn(),
}));

vi.mock('../../balances/read', () => ({
  readBalance: readBalanceMock,
  estimateNativeGasCost: estimateNativeGasCostMock,
}));

vi.mock('../../../consts/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../consts/config')>();
  return {
    ...actual,
    config: { ...actual.config, shouldDisableChains: true },
  };
});

const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';
const BONK_ADDRESS = '0x074238dfa02063792077820584c925b679a013cbab38e5ca61af5627d1eda736';

describe('validateBalances', () => {
  beforeEach(() => {
    readBalanceMock.mockReset();
    estimateNativeGasCostMock.mockReset().mockResolvedValue(0n);
  });

  test('checks native IGP fees against native balance for non-native source tokens', async () => {
    readBalanceMock
      .mockResolvedValueOnce(100_000_000n)
      .mockResolvedValueOnce(10_130_000_000_000_000_000n);

    const errors = await validateBalances({
      multiProvider: multiProvider(),
      srcChainInfo: starknetChain(),
      srcToken: bonkToken(),
      sender: '0xsender',
      bestRoute: routeWithNativeFee(10_178_000_000_000_000_000n),
      amountAtomic: 10_000_000n,
    });

    expect(errors).toEqual({
      amount: 'Insufficient STRK for transaction value and gas (need 0.048 more STRK)',
    });
    expect(readBalanceMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        tokenAddress: NATIVE_ADDRESS,
        isNative: true,
      }),
    );
  });

  test('checks native fee components through the multi-VM balance path', async () => {
    readBalanceMock.mockResolvedValueOnce(100_000_000n).mockResolvedValueOnce(6n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Sealevel),
      srcChainInfo: solanaChain(),
      srcToken: bonkToken({
        chainId: 1399811149,
        chainName: 'solanamainnet',
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      }),
      sender: 'ApMsTRbsbBpsmzpht4JpzudaBEef4AqW1GfnEf6az6h9',
      bestRoute: routeWithNativeFee(7n, 1399811149),
      amountAtomic: 10_000_000n,
    });

    expect(errors).toEqual({
      amount: 'Insufficient SOL for transaction value and gas (need 0.000000001 more SOL)',
    });
    expect(readBalanceMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        chainName: 'solanamainnet',
        tokenAddress: NATIVE_ADDRESS,
        isNative: true,
      }),
    );
  });

  test('adds wallet execution fee to native balance validation', async () => {
    readBalanceMock
      .mockResolvedValueOnce(100_000_000n)
      .mockResolvedValueOnce(10_370_000_000_000_000_000n);

    const errors = await validateBalances({
      multiProvider: multiProvider(),
      srcChainInfo: starknetChain(),
      srcToken: bonkToken(),
      sender: '0xsender',
      bestRoute: routeWithNativeFee(10_178_000_000_000_000_000n),
      amountAtomic: 10_000_000n,
      nativeExecutionFee: 750_000_000_000_000_000n,
    });

    expect(errors).toEqual({
      amount: 'Insufficient STRK for transaction value and gas (need 0.558 more STRK)',
    });
  });

  test('does not double count native quoted fees already included in tx value', async () => {
    readBalanceMock.mockResolvedValueOnce(100_000_000n).mockResolvedValueOnce(10n);
    estimateNativeGasCostMock.mockResolvedValueOnce(3n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Ethereum),
      srcChainInfo: evmChain(),
      srcToken: bonkToken({ chainId: 1, chainName: 'ethereum' }),
      sender: '0xsender',
      bestRoute: routeWithNativeFee(7n, 1, {
        to: '0x0000000000000000000000000000000000000001',
        data: '0x',
        value: '7',
      }),
      amountAtomic: 10_000_000n,
    });

    expect(errors).toBeNull();
  });

  test('does not double count native IGP fees for native source tokens', async () => {
    readBalanceMock.mockResolvedValueOnce(10_000_001n);

    const errors = await validateBalances({
      multiProvider: multiProvider(),
      srcChainInfo: starknetChain(),
      srcToken: strkToken(),
      sender: '0xsender',
      bestRoute: routeWithNativeFee(1n),
      amountAtomic: 10n,
    });

    expect(errors).toBeNull();
    expect(readBalanceMock).toHaveBeenCalledTimes(1);
  });

  // Regression: native-token warp routes (e.g. GNET galactica→solana) pay the
  // interchain fee in the source native token, so the engine folds it into
  // amountIn (amountOut = amountIn − igp) and tx.value = amountIn. The balance
  // check must not add the same-token IGP again — the full balance covers it.
  test('does not double count same-token IGP already included in amountIn for native source', async () => {
    readBalanceMock.mockResolvedValueOnce(1000n);

    const route: AugmentedRoute = {
      raw: {
        steps: [
          {
            type: 'bridge',
            chain: 358974494,
            destChain: 1399811149,
            asset: NATIVE_ADDRESS,
            router: NATIVE_ADDRESS,
            amountIn: '1000',
            amountOut: '767',
            bridgeSymbol: 'STRK',
            warpRouteId: 'STRK/native',
            fee: {
              tokenFee: '0',
              igpToken: NATIVE_ADDRESS,
              igpAmount: '233',
              localNativeFee: '0',
            },
          },
        ],
        output: '767',
        outputMin: '767',
        executionKind: 'warpDirect',
        connection: { symbol: 'STRK', warpRouteId: 'STRK/native' },
        gas: { originGas: '0', destGas: '0' },
        tx: { to: '0x0000000000000000000000000000000000000001', data: '0x', value: '1000' },
        txs: [],
        approval: null,
      } as RouteResponse,
      feeBreakdown: {
        components: [
          { category: 'igp', amount: 233n, chainId: 358974494, tokenAddress: NATIVE_ADDRESS },
        ],
        originGas: 0n,
        destGas: 0n,
      },
      hasFixedOutput: true,
    };

    const errors = await validateBalances({
      multiProvider: multiProvider(),
      srcChainInfo: starknetChain(),
      srcToken: strkToken(),
      sender: '0xsender',
      bestRoute: route,
      amountAtomic: 1000n,
    });

    expect(errors).toBeNull();
    expect(readBalanceMock).toHaveBeenCalledTimes(1);
  });
});

describe('validateQuote', () => {
  test('rejects expired quotes', () => {
    const now = Math.floor(Date.now() / 1000);

    expect(
      validateQuote({
        bestRoute: routeWithNativeFee(0n, 358974494, {
          to: '0x0000000000000000000000000000000000000001',
          data: '0x',
          value: '0',
        }),
        quoteExpiresAt: now - 1,
      }),
    ).toEqual({ form: 'Quote has expired — refresh to continue' });
  });

  test('accepts executable unexpired quotes', () => {
    const now = Math.floor(Date.now() / 1000);

    expect(
      validateQuote({
        bestRoute: routeWithNativeFee(0n, 358974494, {
          to: '0x0000000000000000000000000000000000000001',
          data: '0x',
          value: '0',
        }),
        quoteExpiresAt: now + 30,
      }),
    ).toBeNull();
  });

  test('rejects stale quotes whose route amount no longer matches the form amount', () => {
    const now = Math.floor(Date.now() / 1000);

    expect(
      validateQuote({
        bestRoute: routeWithNativeFee(0n, 358974494, {
          to: '0x0000000000000000000000000000000000000001',
          data: '0x',
          value: '0',
        }),
        quoteExpiresAt: now + 30,
        amountAtomic: 11_000_000n,
      }),
    ).toEqual({ form: 'Quote amount is stale — refresh to continue' });
  });
});

describe('validateChains', () => {
  test('rejects disabled origin chains returned by the engine', () => {
    expect(
      validateChains(
        {
          srcChain: 3637,
          dstChain: 1,
          srcToken: NATIVE_ADDRESS,
          dstToken: NATIVE_ADDRESS,
          amount: '1',
          recipient: '',
          slippageBps: 100,
        },
        [botanixChain(), evmChain()],
        multiProvider(ProtocolType.Ethereum, ['botanix']),
      ),
    ).toEqual({ ok: false, error: { srcChain: 'Origin chain unavailable' } });
  });

  test('rejects disabled destination chains returned by the engine', () => {
    expect(
      validateChains(
        {
          srcChain: 1,
          dstChain: 3637,
          srcToken: NATIVE_ADDRESS,
          dstToken: NATIVE_ADDRESS,
          amount: '1',
          recipient: '',
          slippageBps: 100,
        },
        [evmChain(), botanixChain()],
        multiProvider(ProtocolType.Ethereum, ['botanix']),
      ),
    ).toEqual({ ok: false, error: { dstChain: 'Destination chain unavailable' } });
  });
});

function multiProvider(protocol = ProtocolType.Starknet, disabledChains: string[] = []) {
  const disabledChainSet = new Set(disabledChains);
  return {
    tryGetProtocol: () => protocol,
    tryGetChainMetadata: (chainName: string) =>
      disabledChainSet.has(chainName)
        ? {
            name: chainName,
            availability: {
              status: ChainStatus.Disabled,
              reasons: [ChainDisabledReason.Unavailable],
            },
          }
        : { name: chainName },
  } as never;
}

function starknetChain(): ChainDiscovery {
  return {
    id: 358974494,
    name: 'Starknet',
    chainName: 'starknet',
    protocol: ProtocolType.Starknet,
    nativeCurrency: { name: 'Starknet Token', symbol: 'STRK', decimals: 18 },
    universalRouter: '0x0000000000000000000000000000000000000001',
    dex: null,
    canSwap: false,
    canExecute: true,
    supportsNative: true,
  };
}

function solanaChain(): ChainDiscovery {
  return {
    id: 1399811149,
    name: 'Solana',
    chainName: 'solanamainnet',
    protocol: ProtocolType.Sealevel,
    nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
    universalRouter: '0x0000000000000000000000000000000000000001',
    dex: null,
    canSwap: false,
    canExecute: true,
    supportsNative: true,
  };
}

function evmChain(): ChainDiscovery {
  return {
    id: 1,
    name: 'Ethereum',
    chainName: 'ethereum',
    protocol: ProtocolType.Ethereum,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    universalRouter: '0x0000000000000000000000000000000000000001',
    dex: null,
    canSwap: false,
    canExecute: true,
    supportsNative: true,
  };
}

function botanixChain(): ChainDiscovery {
  return {
    id: 3637,
    name: 'Botanix',
    chainName: 'botanix',
    protocol: ProtocolType.Ethereum,
    nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
    universalRouter: '0x0000000000000000000000000000000000000001',
    dex: null,
    canSwap: false,
    canExecute: true,
    supportsNative: true,
  };
}

function bonkToken(overrides: Partial<UiToken> = {}): UiToken {
  return {
    chainId: 358974494,
    address: BONK_ADDRESS,
    symbol: 'Bonk',
    decimals: 6,
    isNative: false,
    isBridgeToken: true,
    isPoolToken: false,
    canBridge: true,
    canSwap: false,
    bridgeSymbols: ['Bonk'],
    warpRouteIds: ['Bonk/starknet'],
    chainName: 'starknet',
    name: 'Bonk',
    addressOrDenom: BONK_ADDRESS,
    ...overrides,
  };
}

function strkToken(): UiToken {
  return {
    ...bonkToken(),
    address: NATIVE_ADDRESS,
    symbol: 'STRK',
    decimals: 18,
    isNative: true,
    name: 'Starknet Token',
    addressOrDenom: NATIVE_ADDRESS,
  };
}

function routeWithNativeFee(
  nativeFee: bigint,
  chainId = 358974494,
  tx: RouteResponse['tx'] = null,
): AugmentedRoute {
  return {
    raw: {
      steps: [
        {
          type: 'bridge',
          chain: chainId,
          destChain: 1399811149,
          asset: BONK_ADDRESS,
          router: BONK_ADDRESS,
          amountIn: '10000000',
          amountOut: '10000000',
          bridgeSymbol: 'Bonk',
          warpRouteId: 'Bonk/starknet',
          fee: {
            tokenFee: '0',
            igpToken: NATIVE_ADDRESS,
            igpAmount: nativeFee.toString(),
            localNativeFee: '0',
          },
        },
      ],
      output: '10000000',
      outputMin: '10000000',
      executionKind: 'sdkWarp',
      connection: { symbol: 'Bonk', warpRouteId: 'Bonk/starknet' },
      gas: { originGas: '200000', destGas: '0' },
      tx,
      txs: [],
      approval: null,
    } as RouteResponse,
    feeBreakdown: {
      components: [
        {
          category: 'igp',
          amount: nativeFee,
          chainId,
          tokenAddress: NATIVE_ADDRESS,
        },
      ],
      originGas: 200000n,
      destGas: 0n,
    },
    hasFixedOutput: true,
  };
}
