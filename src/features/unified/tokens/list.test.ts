import { afterEach, describe, expect, test } from 'vitest';

import { config } from '../../../consts/config';
import { createMockToken, createTokenConnectionMock } from '../../../utils/test';
import type { UiToken } from '../../swap/tokens/types';
import { getTokenKey, groupTokensByCollateral } from '../../tokens/utils';
import {
  buildUnifiedTokenBalanceInfo,
  getBalanceFetchLimit,
  getVisibleUnifiedTokens,
  matchesUnifiedTokenSearch,
  sortUnifiedTokensByBalance,
} from './list';
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
  test('search matches engine swap token addresses on merged rows', () => {
    const token = createUnifiedToken({
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      bridgeToken: createMockToken({
        addressOrDenom: '0x2222222222222222222222222222222222222222',
        collateralAddressOrDenom: '0x3333333333333333333333333333333333333333',
      }),
      swapToken: createSwapToken({
        address: '0x4444444444444444444444444444444444444444',
        addressOrDenom: '0x4444444444444444444444444444444444444444',
      }),
    });

    expect(
      matchesUnifiedTokenSearch({
        token,
        query: '0x4444444444444444444444444444444444444444',
        chainDisplayName: 'Ethereum',
      }),
    ).toBe(true);
  });

  test('search still ignores unrelated addresses on merged rows', () => {
    const token = createUnifiedToken({
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      bridgeToken: createMockToken({
        addressOrDenom: '0x2222222222222222222222222222222222222222',
        collateralAddressOrDenom: '0x3333333333333333333333333333333333333333',
      }),
      swapToken: createSwapToken({
        address: '0x4444444444444444444444444444444444444444',
        addressOrDenom: '0x4444444444444444444444444444444444444444',
      }),
    });

    expect(
      matchesUnifiedTokenSearch({
        token,
        query: '0x5555555555555555555555555555555555555555',
        chainDisplayName: 'Ethereum',
      }),
    ).toBe(false);
  });

  test('fetches balances for the whole default featured list', () => {
    expect(
      getBalanceFetchLimit({
        tokenCount: 61,
        requestedLimit: 50,
        hasFilter: false,
        hasFeaturedTokens: true,
      }),
    ).toBe(61);
  });

  test('keeps progressive balance fetching for filtered lists', () => {
    expect(
      getBalanceFetchLimit({
        tokenCount: 61,
        requestedLimit: 50,
        hasFilter: true,
        hasFeaturedTokens: true,
      }),
    ).toBe(50);
  });

  test('keeps progressive balance fetching when no featured tokens are configured', () => {
    expect(
      getBalanceFetchLimit({
        tokenCount: 80,
        requestedLimit: 50,
        hasFilter: false,
        hasFeaturedTokens: false,
      }),
    ).toBe(50);
  });

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

  test('matches featured tokens by bridge token refs', () => {
    config.featuredTokens.splice(
      0,
      config.featuredTokens.length,
      'ethereum-0x1111111111111111111111111111111111111111',
    );
    const bridgeToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x1111111111111111111111111111111111111111',
    });
    const featured = createUnifiedToken({
      key: 'ethereum-usdc',
      chainName: 'ethereum',
      symbol: 'USDC',
      bridgeToken,
      capabilities: { bridge: true, swap: false },
    });
    const regular = createUnifiedToken({
      key: 'ethereum-dai',
      chainName: 'ethereum',
      symbol: 'DAI',
      capabilities: { bridge: true, swap: false },
    });

    const result = getVisibleUnifiedTokens({
      allTokens: [regular, featured],
      counterpartToken: undefined,
      selectionMode: 'origin',
      collateralGroups: new Map(),
      engineEnabled: true,
      hasFilter: false,
    });

    expect(result.tokens).toEqual([featured]);
  });

  test('matches featured tokens by swap token refs', () => {
    config.featuredTokens.splice(
      0,
      config.featuredTokens.length,
      'ethereum-0x3333333333333333333333333333333333333333',
    );
    const featured = createUnifiedToken({
      key: 'ethereum-swap-token',
      chainName: 'ethereum',
      symbol: 'SWAP',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken({
        chainName: 'ethereum',
        address: '0x3333333333333333333333333333333333333333',
        addressOrDenom: '0x3333333333333333333333333333333333333333',
        symbol: 'SWAP',
      }),
    });
    const regular = createUnifiedToken({
      key: 'ethereum-dai',
      chainName: 'ethereum',
      symbol: 'DAI',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken({ chainName: 'ethereum', symbol: 'DAI' }),
    });

    const result = getVisibleUnifiedTokens({
      allTokens: [regular, featured],
      counterpartToken: undefined,
      selectionMode: 'origin',
      collateralGroups: new Map(),
      engineEnabled: true,
      hasFilter: false,
    });

    expect(result.tokens).toEqual([featured]);
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

  test('balance sorting keeps featured tokens before non-featured tokens', () => {
    const firstFeatured = config.featuredTokens[0];
    const [chainName, symbol] = firstFeatured.split('-');
    const featured = createUnifiedToken({
      key: firstFeatured,
      chainName,
      symbol,
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken({ chainName, symbol }),
    });
    const regular = createUnifiedToken({
      key: 'regular',
      chainName: 'zzz',
      symbol: 'AAA',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken({ chainName: 'zzz', symbol: 'AAA' }),
    });

    const result = sortUnifiedTokensByBalance({
      tokens: [featured, regular],
      balanceInfo: new Map([
        [featured.key, { usd: 1, balance: 1n }],
        [regular.key, { usd: 100, balance: 100n }],
      ]),
      counterpartToken: undefined,
      selectionMode: 'origin',
      collateralGroups: new Map(),
      engineEnabled: true,
    });

    expect(result.map((token) => token.key)).toEqual([featured.key, regular.key]);
  });

  test('balance sorting keeps bridge routes before swap routes', () => {
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
      swapToken: createSwapToken({ chainName: 'ethereum' }),
    });
    const bridgeDestination = createUnifiedToken({
      key: 'bridge',
      chainName: 'arbitrum',
      symbol: 'ZZZ',
      capabilities: { bridge: true, swap: true },
      bridgeToken: destinationBridgeToken,
      swapToken: createSwapToken({ chainName: 'arbitrum', symbol: 'ZZZ' }),
    });
    const swapDestination = createUnifiedToken({
      key: 'swap',
      chainName: 'arbitrum',
      symbol: 'AAA',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken({ chainName: 'arbitrum', symbol: 'AAA' }),
    });

    const result = sortUnifiedTokensByBalance({
      tokens: [bridgeDestination, swapDestination],
      balanceInfo: new Map([
        [bridgeDestination.key, { usd: 1, balance: 1n }],
        [swapDestination.key, { usd: 100, balance: 100n }],
      ]),
      counterpartToken: counterpart,
      selectionMode: 'destination',
      collateralGroups,
      engineEnabled: true,
    });

    expect(result.map((token) => token.key)).toEqual(['bridge', 'swap']);
  });

  test('balance sorting uses usd value within the same priority bucket', () => {
    config.featuredTokens.splice(0, config.featuredTokens.length);
    const lowValue = createUnifiedToken({
      key: 'low-value',
      symbol: 'AAA',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken({ symbol: 'AAA' }),
    });
    const highValue = createUnifiedToken({
      key: 'high-value',
      symbol: 'BBB',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken({ symbol: 'BBB' }),
    });

    const result = sortUnifiedTokensByBalance({
      tokens: [lowValue, highValue],
      balanceInfo: new Map([
        [lowValue.key, { usd: 1, balance: 100n }],
        [highValue.key, { usd: 100, balance: 1n }],
      ]),
      counterpartToken: undefined,
      selectionMode: 'origin',
      collateralGroups: new Map(),
      engineEnabled: true,
    });

    expect(result.map((token) => token.key)).toEqual(['high-value', 'low-value']);
  });

  test('balance sorting normalizes token decimals when usd is unavailable', () => {
    config.featuredTokens.splice(0, config.featuredTokens.length);
    const oneUsdc = createUnifiedToken({
      key: 'one-usdc',
      symbol: 'USDC',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken({ symbol: 'USDC', decimals: 6 }),
    });
    const pointOneEth = createUnifiedToken({
      key: 'point-one-eth',
      symbol: 'ETH',
      capabilities: { bridge: false, swap: true },
      swapToken: createSwapToken({ symbol: 'ETH', decimals: 18 }),
    });

    const result = sortUnifiedTokensByBalance({
      tokens: [pointOneEth, oneUsdc],
      balanceInfo: new Map([
        [pointOneEth.key, { balance: 100_000_000_000_000_000n, decimals: 18, usd: null }],
        [oneUsdc.key, { balance: 1_000_000n, decimals: 6, usd: null }],
      ]),
      counterpartToken: undefined,
      selectionMode: 'origin',
      collateralGroups: new Map(),
      engineEnabled: true,
    });

    expect(result.map((token) => token.key)).toEqual(['one-usdc', 'point-one-eth']);
  });

  test('balance info keeps decimals from the selected route member', () => {
    const primary = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      decimals: 18,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0x1111111111111111111111111111111111111111',
    });
    const routeMember = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x1111111111111111111111111111111111111111',
    });
    const token = createUnifiedToken({
      key: 'deduped-usdc',
      decimals: primary.decimals,
      bridgeToken: primary,
      bridgeRouteTokens: [primary, routeMember],
    });

    const result = buildUnifiedTokenBalanceInfo({
      tokens: [token],
      bridgeBalances: {
        [getTokenKey(routeMember)]: 1_000_000n,
      },
      swapBalances: {},
      prices: {},
    });

    expect(result.get(token.key)).toMatchObject({
      balance: 1_000_000n,
      decimals: 6,
    });
  });
});
