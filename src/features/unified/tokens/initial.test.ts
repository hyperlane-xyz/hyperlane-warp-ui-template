import { afterEach, describe, expect, test, vi } from 'vitest';

import type { UiToken } from '../../swap/tokens/types';
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

  test('uses bridge-style default chain-symbol token refs', () => {
    const origin = createUnifiedToken({ key: 'ethereum-USDC', chainName: 'ethereum' });
    const destination = createUnifiedToken({
      key: 'base-USDC',
      chainName: 'base',
      chainId: 8453,
      swapToken: createSwapToken({ chainName: 'base', chainId: 8453 }),
    });

    expect(
      getInitialUnifiedTokenKeys({
        tokens: [destination, origin],
        collateralGroups: new Map(),
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

  test('falls back to first routable pair when defaults do not exist', () => {
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
      destinationTokenKey: 'bar-destination',
    });
  });
});
