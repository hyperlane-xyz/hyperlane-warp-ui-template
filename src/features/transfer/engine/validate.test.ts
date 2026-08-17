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

  test('does not add embedded IGP on top of EVM native bridge input', async () => {
    readBalanceMock.mockResolvedValueOnce(1_000n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Ethereum),
      srcChainInfo: evmChain(),
      srcToken: evmNativeToken(),
      sender: '0xsender',
      bestRoute: bridgeRoute({
        chainId: 1,
        asset: NATIVE_ADDRESS,
        amountIn: 1_000n,
        amountOut: 767n,
        igpAmount: 233n,
        igpToken: NATIVE_ADDRESS,
        igpIncludedInAmountIn: true,
      }),
      amountAtomic: 1_000n,
    });

    expect(errors).toBeNull();
    expect(readBalanceMock).toHaveBeenCalledTimes(1);
  });

  test('keeps non-EVM native IGP fees on top of bridge input', async () => {
    readBalanceMock.mockResolvedValueOnce(1_006n);

    const errors = await validateBalances({
      multiProvider: multiProvider(),
      srcChainInfo: starknetChain(),
      srcToken: strkToken(),
      sender: '0xsender',
      bestRoute: bridgeRoute({
        asset: NATIVE_ADDRESS,
        amountIn: 1_000n,
        amountOut: 1_000n,
        igpAmount: 7n,
        igpToken: NATIVE_ADDRESS,
        igpIncludedInAmountIn: false,
      }),
      amountAtomic: 1_000n,
    });

    expect(errors).toEqual({
      amount: 'Insufficient STRK balance (need 0.000000000000000001 more STRK)',
    });
  });

  test('does not add embedded IGP on top of ERC20 bridge input', async () => {
    readBalanceMock.mockResolvedValueOnce(1_000n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Sealevel),
      srcChainInfo: solanaChain(),
      srcToken: bonkToken({
        chainId: 1399811149,
        chainName: 'solanamainnet',
        address: BONK_ADDRESS,
      }),
      sender: 'ApMsTRbsbBpsmzpht4JpzudaBEef4AqW1GfnEf6az6h9',
      bestRoute: bridgeRoute({
        chainId: 1399811149,
        asset: BONK_ADDRESS,
        amountIn: 1_000n,
        amountOut: 993n,
        igpAmount: 7n,
        igpToken: BONK_ADDRESS,
        igpIncludedInAmountIn: true,
      }),
      amountAtomic: 1_000n,
    });

    expect(errors).toBeNull();
    expect(readBalanceMock).toHaveBeenCalledTimes(1);
  });

  test.each([
    {
      name: 'EVM ERC20',
      protocol: ProtocolType.Ethereum,
      chain: evmChain(),
      token: bonkToken({ chainId: 1, chainName: 'ethereum' }),
      sender: '0xsender',
    },
    {
      name: 'Sealevel synthetic',
      protocol: ProtocolType.Sealevel,
      chain: solanaChain(),
      token: bonkToken({
        chainId: 1399811149,
        chainName: 'solanamainnet',
        address: BONK_ADDRESS,
      }),
      sender: 'ApMsTRbsbBpsmzpht4JpzudaBEef4AqW1GfnEf6az6h9',
    },
  ])('does not add API tokenFee on top of $name bridge amountIn', async (routeCase) => {
    readBalanceMock.mockResolvedValueOnce(1_000n);

    const errors = await validateBalances({
      multiProvider: multiProvider(routeCase.protocol),
      srcChainInfo: routeCase.chain,
      srcToken: routeCase.token,
      sender: routeCase.sender,
      bestRoute: bridgeRoute({
        chainId: routeCase.chain.id,
        asset: routeCase.token.address,
        amountIn: 1_000n,
        amountOut: 990n,
        tokenFee: 10n,
      }),
      amountAtomic: 1_000n,
    });

    expect(errors).toBeNull();
    expect(readBalanceMock).toHaveBeenCalledTimes(1);
  });

  test('recognizes embedded ERC20 IGP reported with the warp router alias', async () => {
    const collateralAddress = '0x1111111111111111111111111111111111111111';
    const routerAddress = '0x2222222222222222222222222222222222222222';
    readBalanceMock.mockResolvedValueOnce(1_000n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Ethereum),
      srcChainInfo: evmChain(),
      srcToken: bonkToken({ chainId: 1, chainName: 'ethereum', address: collateralAddress }),
      sender: '0xsender',
      bestRoute: bridgeRoute({
        chainId: 1,
        asset: collateralAddress,
        router: routerAddress,
        amountIn: 1_000n,
        amountOut: 993n,
        igpAmount: 7n,
        igpToken: routerAddress,
      }),
      amountAtomic: 1_000n,
    });

    expect(errors).toBeNull();
    expect(readBalanceMock).toHaveBeenCalledTimes(1);
  });

  test('still requires separately funded ERC20 IGP from the wallet', async () => {
    const collateralAddress = '0x1111111111111111111111111111111111111111';
    const feeTokenAddress = '0x3333333333333333333333333333333333333333';
    readBalanceMock.mockResolvedValueOnce(1_000n).mockResolvedValueOnce(6n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Ethereum),
      srcChainInfo: evmChain(),
      srcToken: bonkToken({ chainId: 1, chainName: 'ethereum', address: collateralAddress }),
      sender: '0xsender',
      bestRoute: bridgeRoute({
        chainId: 1,
        asset: collateralAddress,
        amountIn: 1_000n,
        amountOut: 1_000n,
        igpAmount: 7n,
        igpToken: feeTokenAddress,
      }),
      amountAtomic: 1_000n,
    });

    expect(errors).toEqual({ amount: 'Insufficient balance to cover interchain gas fee' });
    expect(readBalanceMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ tokenAddress: feeTokenAddress, isNative: false }),
    );
  });

  test('treats API IGP funding metadata as authoritative over fallback inference', async () => {
    readBalanceMock.mockResolvedValueOnce(1_006n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Ethereum),
      srcChainInfo: evmChain(),
      srcToken: evmNativeToken(),
      sender: '0xsender',
      bestRoute: bridgeRoute({
        chainId: 1,
        asset: NATIVE_ADDRESS,
        amountIn: 1_000n,
        amountOut: 1_000n,
        igpAmount: 7n,
        igpToken: NATIVE_ADDRESS,
        igpIncludedInAmountIn: false,
      }),
      amountAtomic: 1_000n,
    });

    expect(errors).toEqual({
      amount: 'Insufficient ETH balance (need 0.000000000000000001 more ETH)',
    });
  });

  test('does not require bridge-token IGP from the wallet after an ERC20 origin swap', async () => {
    const srcTokenAddress = '0x1111111111111111111111111111111111111111';
    const bridgeTokenAddress = '0x2222222222222222222222222222222222222222';
    readBalanceMock.mockResolvedValueOnce(1_000n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Ethereum),
      srcChainInfo: evmChain(),
      srcToken: bonkToken({ chainId: 1, chainName: 'ethereum', address: srcTokenAddress }),
      sender: '0xsender',
      bestRoute: originSwapRoute({
        srcToken: srcTokenAddress,
        bridgeToken: bridgeTokenAddress,
        igpToken: bridgeTokenAddress,
        igpAmount: 7n,
      }),
      amountAtomic: 1_000n,
    });

    expect(errors).toBeNull();
    expect(readBalanceMock).toHaveBeenCalledTimes(1);
  });

  test('does not add embedded IGP for bridge and destination-swap routes', async () => {
    const bridgeTokenAddress = '0x2222222222222222222222222222222222222222';
    readBalanceMock.mockResolvedValueOnce(1_000n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Ethereum),
      srcChainInfo: evmChain(),
      srcToken: bonkToken({ chainId: 1, chainName: 'ethereum', address: bridgeTokenAddress }),
      sender: '0xsender',
      bestRoute: withDestinationSwap(
        bridgeRoute({
          chainId: 1,
          asset: bridgeTokenAddress,
          amountIn: 1_000n,
          amountOut: 993n,
          igpAmount: 7n,
          igpToken: bridgeTokenAddress,
          igpIncludedInAmountIn: true,
        }),
      ),
      amountAtomic: 1_000n,
    });

    expect(errors).toBeNull();
    expect(readBalanceMock).toHaveBeenCalledTimes(1);
  });

  test('does not add embedded IGP for origin-swap, bridge, and destination-swap routes', async () => {
    const srcTokenAddress = '0x1111111111111111111111111111111111111111';
    const bridgeTokenAddress = '0x2222222222222222222222222222222222222222';
    readBalanceMock.mockResolvedValueOnce(1_000n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Ethereum),
      srcChainInfo: evmChain(),
      srcToken: bonkToken({ chainId: 1, chainName: 'ethereum', address: srcTokenAddress }),
      sender: '0xsender',
      bestRoute: withDestinationSwap(
        originSwapRoute({
          srcToken: srcTokenAddress,
          bridgeToken: bridgeTokenAddress,
          igpToken: bridgeTokenAddress,
          igpAmount: 7n,
        }),
      ),
      amountAtomic: 1_000n,
    });

    expect(errors).toBeNull();
    expect(readBalanceMock).toHaveBeenCalledTimes(1);
  });

  test('keeps native IGP on top when a native origin swap bridges an ERC20', async () => {
    const bridgeTokenAddress = '0x2222222222222222222222222222222222222222';
    readBalanceMock.mockResolvedValueOnce(1_006n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Ethereum),
      srcChainInfo: evmChain(),
      srcToken: evmNativeToken(),
      sender: '0xsender',
      bestRoute: originSwapRoute({
        srcToken: NATIVE_ADDRESS,
        bridgeToken: bridgeTokenAddress,
        igpToken: NATIVE_ADDRESS,
        igpAmount: 7n,
      }),
      amountAtomic: 1_000n,
    });

    expect(errors).toEqual({
      amount: 'Insufficient ETH balance (need 0.000000000000000001 more ETH)',
    });
  });

  test.each([
    { name: 'native', token: evmNativeToken(), txValue: '1000' },
    {
      name: 'ERC20',
      token: bonkToken({ chainId: 1, chainName: 'ethereum' }),
      txValue: '0',
    },
  ])('keeps fee-free $name swap balance validation unchanged', async ({ token, txValue }) => {
    readBalanceMock.mockResolvedValueOnce(1_000n);

    const errors = await validateBalances({
      multiProvider: multiProvider(ProtocolType.Ethereum),
      srcChainInfo: evmChain(),
      srcToken: token,
      sender: '0xsender',
      bestRoute: swapRoute(token.address, txValue),
      amountAtomic: 1_000n,
    });

    expect(errors).toBeNull();
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
    standard: 'StarknetHypNative',
    name: 'Starknet Token',
    addressOrDenom: NATIVE_ADDRESS,
  };
}

function evmNativeToken(): UiToken {
  return {
    ...bonkToken(),
    chainId: 1,
    chainName: 'ethereum',
    address: NATIVE_ADDRESS,
    symbol: 'ETH',
    decimals: 18,
    isNative: true,
    standard: 'EvmHypNative',
    name: 'Ether',
    addressOrDenom: NATIVE_ADDRESS,
  };
}

function routeWithNativeFee(
  nativeFee: bigint,
  chainId = 358974494,
  tx: RouteResponse['tx'] = null,
): AugmentedRoute {
  return bridgeRoute({ chainId, igpAmount: nativeFee, tx });
}

function bridgeRoute({
  chainId = 358974494,
  asset = BONK_ADDRESS,
  router = BONK_ADDRESS,
  amountIn = 10_000_000n,
  amountOut = amountIn,
  tokenFee = 0n,
  igpAmount = 0n,
  igpToken = NATIVE_ADDRESS,
  igpIncludedInAmountIn,
  tx = null,
}: {
  chainId?: number;
  asset?: string;
  router?: string;
  amountIn?: bigint;
  amountOut?: bigint;
  tokenFee?: bigint;
  igpAmount?: bigint;
  igpToken?: string;
  igpIncludedInAmountIn?: boolean;
  tx?: RouteResponse['tx'];
}): AugmentedRoute {
  return {
    raw: {
      steps: [
        {
          type: 'bridge',
          chain: chainId,
          destChain: 1399811149,
          asset,
          router,
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          bridgeSymbol: 'Bonk',
          warpRouteId: 'Bonk/starknet',
          fee: {
            tokenFee: tokenFee.toString(),
            igpToken,
            igpAmount: igpAmount.toString(),
            ...(igpIncludedInAmountIn != null && { igpIncludedInAmountIn }),
            localNativeFee: '0',
          },
        },
      ],
      output: amountOut.toString(),
      outputMin: amountOut.toString(),
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
          amount: igpAmount,
          chainId,
          tokenAddress: igpToken,
        },
      ],
      originGas: 200000n,
      destGas: 0n,
    },
    hasFixedOutput: true,
  };
}

function originSwapRoute({
  srcToken,
  bridgeToken,
  igpToken,
  igpAmount,
}: {
  srcToken: string;
  bridgeToken: string;
  igpToken: string;
  igpAmount: bigint;
}): AugmentedRoute {
  const bridge = bridgeRoute({
    chainId: 1,
    asset: bridgeToken,
    amountIn: 900n,
    amountOut: 900n - (igpToken === bridgeToken ? igpAmount : 0n),
    igpAmount,
    igpToken,
  });
  return {
    ...bridge,
    raw: {
      ...bridge.raw,
      steps: [
        {
          type: 'swap',
          chain: 1,
          dex: 'test',
          tokenIn: srcToken,
          tokenOut: bridgeToken,
          amountIn: '1000',
          amountOut: '900',
          path: [srcToken, bridgeToken],
          poolCount: 1,
        },
        ...bridge.raw.steps,
      ],
    },
    hasFixedOutput: false,
  };
}

function swapRoute(tokenIn: string, txValue: string): AugmentedRoute {
  return {
    raw: {
      steps: [
        {
          type: 'swap',
          chain: 1,
          dex: 'test',
          tokenIn,
          tokenOut: '0x2222222222222222222222222222222222222222',
          amountIn: '1000',
          amountOut: '900',
          path: [tokenIn, '0x2222222222222222222222222222222222222222'],
          poolCount: 1,
        },
      ],
      output: '900',
      outputMin: '891',
      executionKind: 'universalRouter',
      connection: null,
      gas: { originGas: '200000', destGas: '0' },
      tx: {
        to: '0x0000000000000000000000000000000000000001',
        data: '0x',
        value: txValue,
      },
      txs: [],
      approval: null,
    },
    feeBreakdown: { components: [], originGas: 200000n, destGas: 0n },
    hasFixedOutput: false,
  };
}

function withDestinationSwap(route: AugmentedRoute): AugmentedRoute {
  const bridgeStep = route.raw.steps.find((step) => step.type === 'bridge');
  if (!bridgeStep) throw new Error('Expected bridge step');
  const tokenOut = '0x3333333333333333333333333333333333333333';
  return {
    ...route,
    raw: {
      ...route.raw,
      steps: [
        ...route.raw.steps,
        {
          type: 'swap',
          chain: bridgeStep.destChain,
          dex: 'test',
          tokenIn: bridgeStep.asset,
          tokenOut,
          amountIn: bridgeStep.amountOut,
          amountOut: '800',
          path: [bridgeStep.asset, tokenOut],
          poolCount: 1,
        },
      ],
      output: '800',
      outputMin: '792',
    },
    hasFixedOutput: false,
  };
}
