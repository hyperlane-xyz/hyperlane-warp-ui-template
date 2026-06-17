import { afterEach, describe, expect, test } from 'vitest';

import { config } from '../../../consts/config';
import { createMockToken, createTokenConnectionMock } from '../../../utils/test';
import type { UiToken } from '../../swap/tokens/types';
import { groupTokensByCollateral } from '../../tokens/utils';
import { getVisibleUnifiedTokens } from './list';
import type { UnifiedToken } from './types';

const originalFeaturedTokens = [...config.featuredTokens];

afterEach(() => {
  config.featuredTokens.splice(0, config.featuredTokens.length, ...originalFeaturedTokens);
});

function createSwapToken(args: Partial<UiToken> = {}): UiToken {
  return {
    chainId: 1,
    address: '0x0000000000000000000000000000000000000001',
    symbol: 'TEST',
    decimals: 18,
    isNative: false,
    isBridgeToken: false,
    isPoolToken: false,
    canBridge: false,
    canSwap: true,
    bridgeSymbols: [],
    warpRouteIds: [],
    chainName: 'ethereum',
    name: 'Test Token',
    addressOrDenom: '0x0000000000000000000000000000000000000001',
    ...args,
  };
}

function createUnifiedToken(args: Partial<UnifiedToken> = {}): UnifiedToken {
  return {
    key: `${args.chainName ?? 'ethereum'}-${args.symbol ?? 'TEST'}`,
    chainName: 'ethereum',
    chainId: 1,
    addressOrDenom: '0x0000000000000000000000000000000000000001',
    symbol: 'TEST',
    name: 'Test Token',
    decimals: 18,
    isNative: false,
    capabilities: {
      bridge: false,
      swap: false,
    },
    ...args,
  };
}

describe('getVisibleUnifiedTokens', () => {
  test('only shows featured tokens in the default list when featured tokens are configured', () => {
    const firstFeatured = config.featuredTokens[0];
    const [chainName, symbol] = firstFeatured.split('-');
    const regular = createUnifiedToken({
      key: 'z-regular',
      chainName: 'zzz',
      symbol: 'AAA',
      capabilities: { bridge: true, swap: false },
    });
    const featured = createUnifiedToken({
      key: firstFeatured,
      chainName,
      symbol,
      capabilities: { bridge: false, swap: false },
    });

    const result = getVisibleUnifiedTokens({
      allTokens: [regular, featured],
      counterpartToken: undefined,
      selectionMode: 'origin',
      collateralGroups: new Map(),
      engineEnabled: true,
      hasFilter: false,
    });

    expect(result.tokens.map((token) => token.key)).toEqual([firstFeatured]);
  });

  test('does not hide non-featured tokens when searching', () => {
    const hiddenWithoutFilter = createUnifiedToken({
      key: 'non-featured-unrouted',
      chainName: 'zzz',
      symbol: 'ZZZ',
      capabilities: { bridge: false, swap: false },
    });

    const result = getVisibleUnifiedTokens({
      allTokens: [hiddenWithoutFilter],
      counterpartToken: undefined,
      selectionMode: 'origin',
      collateralGroups: new Map(),
      engineEnabled: true,
      hasFilter: true,
    });

    expect(result.tokens).toEqual([hiddenWithoutFilter]);
  });

  test('caps the default list when featured tokens are not configured', () => {
    config.featuredTokens.splice(0, config.featuredTokens.length);
    const tokens = Array.from({ length: 55 }, (_, index) =>
      createUnifiedToken({
        key: `token-${index}`,
        chainName: 'ethereum',
        symbol: `T${String(index).padStart(2, '0')}`,
        capabilities: { bridge: true, swap: false },
      }),
    );

    const result = getVisibleUnifiedTokens({
      allTokens: tokens,
      counterpartToken: undefined,
      selectionMode: 'origin',
      collateralGroups: new Map(),
      engineEnabled: true,
      hasFilter: false,
    });

    expect(result.tokens).toHaveLength(50);
    expect(result.isLimited).toBe(true);
  });

  test('hides unroutable tokens when a counterpart is selected while searching', () => {
    const counterpart = createUnifiedToken({
      key: 'counterpart',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken(),
    });
    const routable = createUnifiedToken({
      key: 'routable',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken(),
    });
    const unroutable = createUnifiedToken({
      key: 'unroutable',
      capabilities: { bridge: false, swap: false },
    });

    const result = getVisibleUnifiedTokens({
      allTokens: [unroutable, routable],
      counterpartToken: counterpart,
      selectionMode: 'destination',
      collateralGroups: new Map(),
      engineEnabled: true,
      hasFilter: true,
    });

    expect(result.tokens).toEqual([routable]);
  });

  test('keeps unroutable tokens hidden while searching with a counterpart selected', () => {
    const counterpart = createUnifiedToken({
      key: 'counterpart',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken(),
    });
    const unroutable = createUnifiedToken({
      key: 'unroutable',
      capabilities: { bridge: false, swap: false },
    });

    const result = getVisibleUnifiedTokens({
      allTokens: [unroutable],
      counterpartToken: counterpart,
      selectionMode: 'destination',
      collateralGroups: new Map(),
      engineEnabled: true,
      hasFilter: true,
    });

    expect(result.tokens).toEqual([]);
  });

  test('does not constrain origin selection to the current destination token', () => {
    const currentDestination = createUnifiedToken({
      key: 'destination',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken({
        chainName: 'base',
        address: '0x0000000000000000000000000000000000000002',
      }),
    });
    const alternativeOrigin = createUnifiedToken({
      key: 'solana-usdc',
      chainName: 'solanamainnet',
      symbol: 'USDC',
      capabilities: { bridge: true, swap: false },
    });

    const result = getVisibleUnifiedTokens({
      allTokens: [alternativeOrigin],
      counterpartToken: currentDestination,
      selectionMode: 'origin',
      collateralGroups: new Map(),
      engineEnabled: true,
      hasFilter: false,
    });

    expect(result.tokens).toEqual([alternativeOrigin]);
  });

  test('sorts bridge routes before swap-only routes for a selected counterpart', () => {
    const originBridgeToken = createMockToken({
      chainName: 'ethereum',
      connections: [createTokenConnectionMock(undefined, { chainName: 'arbitrum' })],
    });
    const destinationBridgeToken = createMockToken({ chainName: 'arbitrum' });
    const collateralGroups = groupTokensByCollateral([originBridgeToken, destinationBridgeToken]);
    const counterpart = createUnifiedToken({
      key: 'origin',
      chainName: 'ethereum',
      capabilities: { bridge: true, swap: true },
      bridgeToken: originBridgeToken,
      swapToken: createSwapToken({
        chainName: 'ethereum',
        address: '0x0000000000000000000000000000000000000001',
      }),
    });
    const swapOnlyDestination = createUnifiedToken({
      key: 'swap-only',
      chainName: 'arbitrum',
      symbol: 'AAA',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken({
        chainName: 'arbitrum',
        address: '0x0000000000000000000000000000000000000002',
      }),
    });
    const bridgeDestination = createUnifiedToken({
      key: 'bridge',
      chainName: 'arbitrum',
      symbol: 'ZZZ',
      capabilities: { bridge: true, swap: true },
      bridgeToken: destinationBridgeToken,
      swapToken: createSwapToken({
        chainName: 'arbitrum',
        address: '0x0000000000000000000000000000000000000003',
      }),
    });

    const result = getVisibleUnifiedTokens({
      allTokens: [swapOnlyDestination, bridgeDestination],
      counterpartToken: counterpart,
      selectionMode: 'destination',
      collateralGroups,
      engineEnabled: true,
      hasFilter: true,
    });

    expect(result.tokens.map((token) => token.key)).toEqual(['bridge', 'swap-only']);
  });
});
