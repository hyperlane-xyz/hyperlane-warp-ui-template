import { afterEach, describe, expect, test, vi } from 'vitest';

import { createMockToken, createTokenConnectionMock } from '../../../utils/test';
import type { UiToken } from '../../swap/tokens/types';
import { groupTokensByCollateral } from '../../tokens/utils';
import { getInitialUnifiedTokenKeys } from './initial';
import type { UnifiedToken } from './types';

function createSwapToken(args: Partial<UiToken> = {}): UiToken {
  return {
    chainId: 1,
    address: '0x0000000000000000000000000000000000000001',
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
    isBridgeToken: false,
    isPoolToken: true,
    canBridge: false,
    canSwap: true,
    bridgeSymbols: [],
    warpRouteIds: [],
    chainName: 'ethereum',
    name: 'USD Coin',
    addressOrDenom: '0x0000000000000000000000000000000000000001',
    ...args,
  };
}

function createUnifiedToken(args: Partial<UnifiedToken> = {}): UnifiedToken {
  return {
    key: `${args.chainName ?? 'ethereum'}-${args.symbol ?? 'USDC'}`,
    chainName: 'ethereum',
    chainId: 1,
    addressOrDenom: '0x0000000000000000000000000000000000000001',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    swapToken: createSwapToken(),
    capabilities: {
      bridge: false,
      swap: true,
    },
    ...args,
  };
}

describe('getInitialUnifiedTokenKeys', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('uses bridge-style default chain-symbol token refs from config', () => {
    const bridgeDestinationToken = createMockToken({
      chainName: 'base',
      symbol: 'USDC',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x2222222222222222222222222222222222222222',
    });
    const bridgeOriginToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0x1111111111111111111111111111111111111111',
      connections: [createTokenConnectionMock(undefined, bridgeDestinationToken)],
    });
    const bridgeOrigin = createUnifiedToken({
      key: 'ethereum-USDC',
      chainName: 'ethereum',
      symbol: 'USDC',
      bridgeToken: bridgeOriginToken,
      capabilities: { bridge: true, swap: false },
    });
    const bridgeDestination = createUnifiedToken({
      key: 'base-USDC',
      chainName: 'base',
      chainId: 8453,
      symbol: 'USDC',
      bridgeToken: bridgeDestinationToken,
      capabilities: { bridge: true, swap: false },
    });
    const swapOrigin = createUnifiedToken({
      key: 'bsc-native',
      chainName: 'bsc',
      chainId: 56,
      addressOrDenom: '0x0000000000000000000000000000000000000000',
      symbol: 'BNB',
      swapToken: createSwapToken({
        chainName: 'bsc',
        chainId: 56,
        address: '0x0000000000000000000000000000000000000000',
        addressOrDenom: '0x0000000000000000000000000000000000000000',
        symbol: 'BNB',
        isNative: true,
      }),
    });

    expect(
      getInitialUnifiedTokenKeys({
        tokens: [swapOrigin, bridgeDestination, bridgeOrigin],
        collateralGroups: groupTokensByCollateral([bridgeOriginToken]),
        engineEnabled: true,
      }),
    ).toEqual({
      originTokenKey: 'ethereum-USDC',
      destinationTokenKey: 'base-USDC',
    });
  });

  test('uses URL address token refs for swap-style links', () => {
    vi.stubGlobal('window', {
      location: {
        search:
          '?origin=bsc&originToken=0x0000000000000000000000000000000000000000&destination=base&destinationToken=0x2222222222222222222222222222222222222222',
      },
    });
    const origin = createUnifiedToken({
      key: 'bsc-native',
      chainName: 'bsc',
      chainId: 56,
      addressOrDenom: '0x0000000000000000000000000000000000000000',
      symbol: 'BNB',
      swapToken: createSwapToken({
        chainName: 'bsc',
        chainId: 56,
        address: '0x0000000000000000000000000000000000000000',
        addressOrDenom: '0x0000000000000000000000000000000000000000',
        symbol: 'BNB',
        isNative: true,
      }),
    });
    const destination = createUnifiedToken({
      key: 'base-token',
      chainName: 'base',
      chainId: 8453,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      symbol: 'TOKEN',
      swapToken: createSwapToken({
        chainName: 'base',
        chainId: 8453,
        address: '0x2222222222222222222222222222222222222222',
        addressOrDenom: '0x2222222222222222222222222222222222222222',
        symbol: 'TOKEN',
      }),
    });

    expect(
      getInitialUnifiedTokenKeys({
        tokens: [destination, origin],
        collateralGroups: new Map(),
        engineEnabled: true,
      }),
    ).toEqual({
      originTokenKey: 'bsc-native',
      destinationTokenKey: 'base-token',
    });
  });

  test('uses bridge URL matches before swap-only matches', () => {
    vi.stubGlobal('window', {
      location: {
        search:
          '?origin=origin&originToken=0x1111111111111111111111111111111111111111&destination=destination&destinationToken=0x2222222222222222222222222222222222222222',
      },
    });
    const destinationBridgeToken = createMockToken({
      chainName: 'destination',
      symbol: 'USDC',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x2222222222222222222222222222222222222222',
    });
    const originBridgeToken = createMockToken({
      chainName: 'origin',
      symbol: 'USDC',
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0x1111111111111111111111111111111111111111',
      connections: [createTokenConnectionMock(undefined, destinationBridgeToken)],
    });
    const swapOrigin = createUnifiedToken({
      key: 'swap-origin',
      chainName: 'origin',
      swapToken: createSwapToken({
        chainName: 'origin',
        address: '0x1111111111111111111111111111111111111111',
      }),
      capabilities: { bridge: false, swap: true },
    });
    const swapDestination = createUnifiedToken({
      key: 'swap-destination',
      chainName: 'destination',
      swapToken: createSwapToken({
        chainName: 'destination',
        address: '0x2222222222222222222222222222222222222222',
      }),
      capabilities: { bridge: false, swap: true },
    });
    const bridgeOrigin = createUnifiedToken({
      key: 'bridge-origin',
      chainName: 'origin',
      bridgeToken: originBridgeToken,
      capabilities: { bridge: true, swap: false },
    });
    const bridgeDestination = createUnifiedToken({
      key: 'bridge-destination',
      chainName: 'destination',
      bridgeToken: destinationBridgeToken,
      capabilities: { bridge: true, swap: false },
    });

    expect(
      getInitialUnifiedTokenKeys({
        tokens: [swapOrigin, swapDestination, bridgeDestination, bridgeOrigin],
        collateralGroups: groupTokensByCollateral([originBridgeToken]),
        engineEnabled: true,
      }),
    ).toEqual({
      originTokenKey: 'bridge-origin',
      destinationTokenKey: 'bridge-destination',
    });
  });

  test('does not invent a destination when defaults do not resolve', () => {
    const origin = createUnifiedToken({
      key: 'foo-origin',
      chainName: 'foo',
      symbol: 'FOO',
      swapToken: createSwapToken({ chainName: 'foo', symbol: 'FOO' }),
    });
    const destination = createUnifiedToken({
      key: 'bar-destination',
      chainName: 'bar',
      symbol: 'BAR',
      swapToken: createSwapToken({ chainName: 'bar', symbol: 'BAR' }),
    });

    expect(
      getInitialUnifiedTokenKeys({
        tokens: [origin, destination],
        collateralGroups: new Map(),
        engineEnabled: true,
      }),
    ).toEqual({
      originTokenKey: 'foo-origin',
      destinationTokenKey: undefined,
    });
  });

  test('uses a routable URL destination token', () => {
    vi.stubGlobal('window', {
      location: {
        search:
          '?origin=origin&originToken=0x1111111111111111111111111111111111111111&destination=destination&destinationToken=0x2222222222222222222222222222222222222222',
      },
    });
    const destinationBridgeToken = createMockToken({
      chainName: 'destination',
      symbol: 'USDC',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x2222222222222222222222222222222222222222',
    });
    const originBridgeToken = createMockToken({
      chainName: 'origin',
      symbol: 'USDC',
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0x1111111111111111111111111111111111111111',
      connections: [createTokenConnectionMock(undefined, destinationBridgeToken)],
    });
    const origin = createUnifiedToken({
      key: 'origin-usdc',
      chainName: 'origin',
      bridgeToken: originBridgeToken,
      capabilities: { bridge: true, swap: false },
    });
    const destination = createUnifiedToken({
      key: 'destination-usdc',
      chainName: 'destination',
      bridgeToken: destinationBridgeToken,
      capabilities: { bridge: true, swap: false },
    });

    expect(
      getInitialUnifiedTokenKeys({
        tokens: [origin, destination],
        collateralGroups: groupTokensByCollateral([originBridgeToken]),
        engineEnabled: false,
      }),
    ).toEqual({
      originTokenKey: 'origin-usdc',
      destinationTokenKey: 'destination-usdc',
    });
  });

  test('does not repair an unroutable URL destination token', () => {
    vi.stubGlobal('window', {
      location: {
        search:
          '?origin=origin&originToken=0x1111111111111111111111111111111111111111&destination=unroutable&destinationToken=0x3333333333333333333333333333333333333333',
      },
    });
    const routableDestinationBridgeToken = createMockToken({
      chainName: 'routable',
      symbol: 'USDC',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x2222222222222222222222222222222222222222',
    });
    const originBridgeToken = createMockToken({
      chainName: 'origin',
      symbol: 'USDC',
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0x1111111111111111111111111111111111111111',
      connections: [createTokenConnectionMock(undefined, routableDestinationBridgeToken)],
    });
    const origin = createUnifiedToken({
      key: 'origin-usdc',
      chainName: 'origin',
      bridgeToken: originBridgeToken,
      capabilities: { bridge: true, swap: false },
    });
    const unroutableDestination = createUnifiedToken({
      key: 'unroutable-usdc',
      chainName: 'unroutable',
      bridgeToken: createMockToken({
        chainName: 'unroutable',
        symbol: 'USDC',
        addressOrDenom: '0x3333333333333333333333333333333333333333',
        collateralAddressOrDenom: '0x3333333333333333333333333333333333333333',
      }),
      capabilities: { bridge: true, swap: false },
    });
    const routableDestination = createUnifiedToken({
      key: 'routable-usdc',
      chainName: 'routable',
      bridgeToken: routableDestinationBridgeToken,
      capabilities: { bridge: true, swap: false },
    });

    expect(
      getInitialUnifiedTokenKeys({
        tokens: [origin, unroutableDestination, routableDestination],
        collateralGroups: groupTokensByCollateral([originBridgeToken]),
        engineEnabled: false,
      }),
    ).toEqual({
      originTokenKey: 'origin-usdc',
      destinationTokenKey: undefined,
    });
  });
});
