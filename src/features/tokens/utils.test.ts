import { TestChainName, TokenStandard, WarpCore } from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createMockToken, createTokenConnectionMock } from '../../utils/test';
import {
  buildTokensArray,
  checkTokenHasRoute,
  checkTokenPairHasRoute,
  checkTokenPickerHasRoute,
  dedupeTokensByCollateral,
  findConnectedDestinationToken,
  findRouteToken,
  getDefaultTokens,
  getTokenKey,
  groupTokensByCollateral,
  isValidMultiCollateralToken,
  setResolvedUnderlyingMap,
  tryGetDefaultOriginToken,
} from './utils';

beforeEach(() => {
  vi.restoreAllMocks();
  // Reset resolved underlying map between tests
  setResolvedUnderlyingMap(new Map());
});

describe('isValidMultiCollateralToken', () => {
  test('should return false if originToken is not collateralized', () => {
    const token = createMockToken({ standard: TokenStandard.CosmosIbc });
    const destToken = createMockToken({ chainName: TestChainName.test2 });
    expect(isValidMultiCollateralToken(token, destToken)).toBe(false);
  });

  test('should return false if destinationToken is not collateralized', () => {
    const token = createMockToken({
      connections: [
        createTokenConnectionMock(undefined, {
          standard: TokenStandard.CosmosIbc,
          collateralAddressOrDenom: undefined,
        }),
      ],
    });
    const destToken = createMockToken({
      chainName: TestChainName.test2,
      standard: TokenStandard.CosmosIbc,
      collateralAddressOrDenom: undefined,
    });
    expect(isValidMultiCollateralToken(token, destToken)).toBe(false);
  });

  test('should return true if originToken is HypNative even without collateralAddressOrDenom', () => {
    const token = createMockToken({
      collateralAddressOrDenom: undefined,
      standard: TokenStandard.EvmHypNative,
    });
    const destToken = createMockToken({
      chainName: TestChainName.test2,
      standard: TokenStandard.EvmHypNative,
      collateralAddressOrDenom: undefined,
    });
    expect(isValidMultiCollateralToken(token, destToken)).toBe(true);
  });

  test('should return true if destinationToken is HypNative even without collateralAddressOrDenom', () => {
    const token = createMockToken({
      standard: TokenStandard.EvmHypNative,
      collateralAddressOrDenom: undefined,
    });
    const destToken = createMockToken({
      chainName: TestChainName.test2,
      standard: TokenStandard.EvmHypNative,
      collateralAddressOrDenom: undefined,
    });
    expect(isValidMultiCollateralToken(token, destToken)).toBe(true);
  });

  test('should return true if destinationToken standard is in TOKEN_COLLATERALIZED_STANDARDS even without collateralAddressOrDenom', () => {
    const token = createMockToken();
    const destToken = createMockToken({
      chainName: TestChainName.test2,
      collateralAddressOrDenom: undefined,
      standard: TokenStandard.EvmHypCollateral,
    });
    expect(isValidMultiCollateralToken(token, destToken)).toBe(true);
  });

  test('should return true when both tokens are collateralized', () => {
    const token = createMockToken({
      connections: [createTokenConnectionMock()],
    });
    const destinationToken = token.getConnectionForChain(TestChainName.test2)!.token;
    expect(isValidMultiCollateralToken(token, destinationToken)).toBe(true);
  });
});

describe('tryGetDefaultOriginToken', () => {
  test('should return null when not a valid multi-collateral token', () => {
    const originToken = createMockToken({
      collateralAddressOrDenom: undefined,
      standard: TokenStandard.EvmHypSynthetic,
    });
    const destinationToken = createMockToken();

    const result = tryGetDefaultOriginToken(originToken, destinationToken, {}, []);

    expect(result).toBeNull();
  });

  test('should return null when defaultMultiCollateralRoutes is undefined', () => {
    const originToken = createMockToken({
      chainName: 'ethereum',
      collateralAddressOrDenom: '0xUSDC',
      connections: [createTokenConnectionMock()],
    });
    const destinationToken = originToken.getConnectionForChain(TestChainName.test2)!.token;

    const result = tryGetDefaultOriginToken(originToken, destinationToken, undefined, []);

    expect(result).toBeNull();
  });

  test('should return null when origin chain not in config', () => {
    const originToken = createMockToken({
      chainName: 'unknownchain',
      collateralAddressOrDenom: '0xUSDC',
      connections: [createTokenConnectionMock()],
    });
    const destinationToken = originToken.getConnectionForChain(TestChainName.test2)!.token;

    const defaultRoutes = {
      ethereum: { '0xUSDC': '0xWarpRoute' },
      arbitrum: { '0xUSDC': '0xWarpRoute' },
    };

    const result = tryGetDefaultOriginToken(originToken, destinationToken, defaultRoutes, []);

    expect(result).toBeNull();
  });

  test('should return null when destination chain not in config', () => {
    const originToken = createMockToken({
      chainName: 'ethereum',
      collateralAddressOrDenom: '0xUSDC',
      connections: [createTokenConnectionMock(undefined, { chainName: 'unknownchain' })],
    });
    const destinationToken = originToken.getConnectionForChain('unknownchain')!.token;

    const defaultRoutes = {
      ethereum: { '0xUSDC': '0xWarpRoute' },
      arbitrum: { '0xUSDC': '0xWarpRoute' },
    };

    const result = tryGetDefaultOriginToken(originToken, destinationToken, defaultRoutes, []);

    expect(result).toBeNull();
  });

  test('should return null when collateral address not found in config', () => {
    const originToken = createMockToken({
      chainName: 'ethereum',
      collateralAddressOrDenom: '0xUnknownCollateral',
      connections: [createTokenConnectionMock(undefined, { chainName: 'arbitrum' })],
    });
    const destinationToken = originToken.getConnectionForChain('arbitrum')!.token;

    const defaultRoutes = {
      ethereum: { '0xUSDC': '0xWarpRoute' },
      arbitrum: { '0xUSDC': '0xWarpRoute' },
    };

    const result = tryGetDefaultOriginToken(originToken, destinationToken, defaultRoutes, []);

    expect(result).toBeNull();
  });

  test('should return null when matching token not found in tokensWithSameCollateralAddresses', () => {
    const originToken = createMockToken({
      chainName: 'ethereum',
      collateralAddressOrDenom: '0xUSDC',
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          collateralAddressOrDenom: '0xUSDC',
        }),
      ],
    });
    const destinationToken = originToken.getConnectionForChain('arbitrum')!.token;

    const defaultRoutes = {
      ethereum: { '0xUSDC': '0xNonExistentWarpRoute' },
      arbitrum: { '0xUSDC': '0xNonExistentDestWarpRoute' },
    };

    // Empty array - no tokens to match
    const result = tryGetDefaultOriginToken(originToken, destinationToken, defaultRoutes, []);

    expect(result).toBeNull();
  });

  test('should return default token when found in tokensWithSameCollateralAddresses', () => {
    // Use proper hex addresses for eqAddress comparison
    const ORIGIN_COLLATERAL = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const DEST_COLLATERAL = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const DEFAULT_ORIGIN_WARP = '0xe1De9910fe71cC216490AC7FCF019e13a34481D7';
    const DEFAULT_DEST_WARP = '0xAd4350Ee0f9f5b85BaB115425426086Ae8384ebb';
    const OTHER_ORIGIN_WARP = '0x3333333333333333333333333333333333333333';
    const OTHER_DEST_WARP = '0x4444444444444444444444444444444444444444';

    const originToken = createMockToken({
      chainName: 'ethereum',
      collateralAddressOrDenom: ORIGIN_COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          collateralAddressOrDenom: DEST_COLLATERAL,
        }),
      ],
    });
    const destinationToken = originToken.getConnectionForChain('arbitrum')!.token;

    // Non-default token (should not be selected)
    const otherOriginToken = createMockToken({
      addressOrDenom: OTHER_ORIGIN_WARP,
      chainName: 'ethereum',
      collateralAddressOrDenom: ORIGIN_COLLATERAL,
    });
    const otherDestToken = createMockToken({
      addressOrDenom: OTHER_DEST_WARP,
      chainName: 'arbitrum',
      collateralAddressOrDenom: DEST_COLLATERAL,
    });

    // Default token (should be selected)
    const defaultOriginToken = createMockToken({
      addressOrDenom: DEFAULT_ORIGIN_WARP,
      chainName: 'ethereum',
      collateralAddressOrDenom: ORIGIN_COLLATERAL,
    });
    const defaultDestToken = createMockToken({
      addressOrDenom: DEFAULT_DEST_WARP,
      chainName: 'arbitrum',
      collateralAddressOrDenom: DEST_COLLATERAL,
    });

    const defaultRoutes = {
      ethereum: { [ORIGIN_COLLATERAL]: DEFAULT_ORIGIN_WARP },
      arbitrum: { [DEST_COLLATERAL]: DEFAULT_DEST_WARP },
    };

    // Multiple tokens with same collateral - should find the default one
    const tokensWithSameCollateral = [
      { originToken: otherOriginToken, destinationToken: otherDestToken },
      { originToken: defaultOriginToken, destinationToken: defaultDestToken },
    ];

    const result = tryGetDefaultOriginToken(
      originToken,
      destinationToken,
      defaultRoutes,
      tokensWithSameCollateral,
    );

    expect(result).toBe(defaultOriginToken);
    expect(result).not.toBe(otherOriginToken);
  });

  test('should use native key for HypNative tokens', () => {
    // Use proper hex addresses for eqAddress comparison
    const NATIVE_ORIGIN_WARP = '0x1111111111111111111111111111111111111111';
    const NATIVE_DEST_WARP = '0x2222222222222222222222222222222222222222';
    const OTHER_NATIVE_ORIGIN_WARP = '0x5555555555555555555555555555555555555555';
    const OTHER_NATIVE_DEST_WARP = '0x6666666666666666666666666666666666666666';

    const originToken = createMockToken({
      chainName: 'ethereum',
      collateralAddressOrDenom: undefined,
      standard: TokenStandard.EvmHypNative,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          collateralAddressOrDenom: undefined,
          standard: TokenStandard.EvmHypNative,
        }),
      ],
    });
    const destinationToken = originToken.getConnectionForChain('arbitrum')!.token;

    // Non-default native token (should not be selected)
    const otherOriginToken = createMockToken({
      addressOrDenom: OTHER_NATIVE_ORIGIN_WARP,
      chainName: 'ethereum',
      collateralAddressOrDenom: undefined,
      standard: TokenStandard.EvmHypNative,
    });
    const otherDestToken = createMockToken({
      addressOrDenom: OTHER_NATIVE_DEST_WARP,
      chainName: 'arbitrum',
      collateralAddressOrDenom: undefined,
      standard: TokenStandard.EvmHypNative,
    });

    // Default native token (should be selected)
    const defaultOriginToken = createMockToken({
      addressOrDenom: NATIVE_ORIGIN_WARP,
      chainName: 'ethereum',
      collateralAddressOrDenom: undefined,
      standard: TokenStandard.EvmHypNative,
    });
    const defaultDestToken = createMockToken({
      addressOrDenom: NATIVE_DEST_WARP,
      chainName: 'arbitrum',
      collateralAddressOrDenom: undefined,
      standard: TokenStandard.EvmHypNative,
    });

    const defaultRoutes = {
      ethereum: { native: NATIVE_ORIGIN_WARP },
      arbitrum: { native: NATIVE_DEST_WARP },
    };

    // Multiple native tokens - should find the default one
    const tokensWithSameCollateral = [
      { originToken: otherOriginToken, destinationToken: otherDestToken },
      { originToken: defaultOriginToken, destinationToken: defaultDestToken },
    ];

    const result = tryGetDefaultOriginToken(
      originToken,
      destinationToken,
      defaultRoutes,
      tokensWithSameCollateral,
    );

    expect(result).toBe(defaultOriginToken);
    expect(result).not.toBe(otherOriginToken);
  });
});

describe('dedupeTokensByCollateral', () => {
  test('should return empty array for empty input', () => {
    expect(dedupeTokensByCollateral([])).toEqual([]);
  });

  test('should keep all non-collateralized tokens without deduplication', () => {
    const token1 = createMockToken({
      standard: TokenStandard.EvmHypSynthetic,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
    });
    const token2 = createMockToken({
      standard: TokenStandard.EvmHypSynthetic,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
    });

    const result = dedupeTokensByCollateral([token1, token2]);

    expect(result).toHaveLength(2);
    expect(result).toContain(token1);
    expect(result).toContain(token2);
  });

  test('should keep collateralized tokens with different collateral addresses', () => {
    const token1 = createMockToken({
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    const token2 = createMockToken({
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    });

    const result = dedupeTokensByCollateral([token1, token2]);

    expect(result).toHaveLength(2);
    expect(result).toContain(token1);
    expect(result).toContain(token2);
  });

  test('should dedupe collateralized tokens with same collateral on same chain', () => {
    const collateralAddress = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const token1 = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: collateralAddress,
    });
    const token2 = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: collateralAddress,
    });

    const result = dedupeTokensByCollateral([token1, token2]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(token1);
  });

  test('should keep tokens with same collateral on different chains', () => {
    const collateralAddress = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const token1 = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: collateralAddress,
    });
    const token2 = createMockToken({
      chainName: 'arbitrum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: collateralAddress,
    });

    const result = dedupeTokensByCollateral([token1, token2]);

    expect(result).toHaveLength(2);
    expect(result).toContain(token1);
    expect(result).toContain(token2);
  });

  test('should handle mixed collateralized and non-collateralized tokens', () => {
    const collateralAddress = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const syntheticToken = createMockToken({
      standard: TokenStandard.EvmHypSynthetic,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
    });
    const collateralToken1 = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: collateralAddress,
    });
    const collateralToken2 = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x3333333333333333333333333333333333333333',
      collateralAddressOrDenom: collateralAddress,
    });

    const result = dedupeTokensByCollateral([syntheticToken, collateralToken1, collateralToken2]);

    expect(result).toHaveLength(2);
    expect(result).toContain(syntheticToken);
    expect(result).toContain(collateralToken1);
    expect(result).not.toContain(collateralToken2);
  });

  test('should dedupe HypNative tokens on same chain', () => {
    const token1 = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypNative,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: undefined,
    });
    const token2 = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypNative,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: undefined,
    });

    const result = dedupeTokensByCollateral([token1, token2]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(token1);
  });

  test('should keep HypNative tokens on different chains', () => {
    const token1 = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypNative,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: undefined,
    });
    const token2 = createMockToken({
      chainName: 'arbitrum',
      standard: TokenStandard.EvmHypNative,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: undefined,
    });

    const result = dedupeTokensByCollateral([token1, token2]);

    expect(result).toHaveLength(2);
    expect(result).toContain(token1);
    expect(result).toContain(token2);
  });

  test('should preserve order keeping first token seen', () => {
    const collateralAddress = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const token1 = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: collateralAddress,
      name: 'First Token',
    });
    const token2 = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: collateralAddress,
      name: 'Second Token',
    });
    const token3 = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x3333333333333333333333333333333333333333',
      collateralAddressOrDenom: collateralAddress,
      name: 'Third Token',
    });

    const result = dedupeTokensByCollateral([token1, token2, token3]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('First Token');
  });

  test('should dedupe by symbol as well as collateral address', () => {
    const collateralAddress = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const usdcToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: collateralAddress,
    });
    const usdtToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: collateralAddress,
    });

    const result = dedupeTokensByCollateral([usdcToken, usdtToken]);

    expect(result).toHaveLength(2);
    expect(result).toContain(usdcToken);
    expect(result).toContain(usdtToken);
  });
});

describe('buildTokensArray', () => {
  const ADDR_1 = '0x1111111111111111111111111111111111111111';
  const ADDR_2 = '0x2222222222222222222222222222222222222222';
  const ADDR_3 = '0x3333333333333333333333333333333333333333';
  const COLLATERAL_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  test('should return empty array for empty input', () => {
    expect(buildTokensArray([])).toEqual([]);
  });

  test('should exclude tokens without connections', () => {
    const token = createMockToken({ addressOrDenom: ADDR_1, connections: [] });
    expect(buildTokensArray([token])).toHaveLength(0);
  });

  test('should include origin and destination tokens', () => {
    const origin = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_2 }),
      ],
    });

    const result = buildTokensArray([origin]);

    expect(result).toHaveLength(2);
    expect(result.some((t) => t.addressOrDenom === ADDR_1)).toBe(true);
    expect(result.some((t) => t.addressOrDenom === ADDR_2)).toBe(true);
  });

  test('should dedupe by token key when same token appears multiple times', () => {
    const token1 = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      name: 'First',
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_2 }),
      ],
    });
    const token2 = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      name: 'Second',
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_2 }),
      ],
    });

    const result = buildTokensArray([token1, token2]);

    // 1 deduped origin + 1 destination
    expect(result).toHaveLength(2);
    const originToken = result.find((t) => t.addressOrDenom === ADDR_1);
    expect(originToken).toBeDefined();
    expect(originToken!.name).toBe('First');
  });

  test('should dedupe when two origins share the same destination', () => {
    const token1 = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_3 }),
      ],
    });
    const token2 = createMockToken({
      chainName: 'optimism',
      addressOrDenom: ADDR_2,
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_3 }),
      ],
    });

    const result = buildTokensArray([token1, token2]);

    // 2 origins + 1 shared destination
    expect(result).toHaveLength(3);
    expect(result.filter((t) => t.addressOrDenom === ADDR_3)).toHaveLength(1);
  });

  test('should dedupe when a token is both origin and destination', () => {
    const tokenA = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_2 }),
      ],
    });
    const tokenB = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_2,
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'ethereum', addressOrDenom: ADDR_1 }),
      ],
    });

    const result = buildTokensArray([tokenA, tokenB]);

    expect(result).toHaveLength(2);
    expect(result.filter((t) => t.addressOrDenom === ADDR_1)).toHaveLength(1);
    expect(result.filter((t) => t.addressOrDenom === ADDR_2)).toHaveLength(1);
  });

  test('should dedupe tokens with different addresses but same collateral on same chain', () => {
    const token1 = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL_USDC,
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_3 }),
      ],
    });
    const token2 = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL_USDC,
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'optimism', addressOrDenom: ADDR_3 }),
      ],
    });

    const result = buildTokensArray([token1, token2]);

    // Only 1 origin (deduped by collateral) + destinations
    const originTokens = result.filter((t) => t.chainName === 'ethereum');
    expect(originTokens).toHaveLength(1);
    expect(originTokens[0].addressOrDenom).toBe(ADDR_1);
  });
});

describe('checkTokenHasRoute', () => {
  const COLLATERAL_A = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const COLLATERAL_B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
  const ADDR_1 = '0x1111111111111111111111111111111111111111';
  const ADDR_2 = '0x2222222222222222222222222222222222222222';

  test('should return true when origin group has connection to dest collateral', () => {
    const origin = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL_A,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          addressOrDenom: ADDR_2,
          collateralAddressOrDenom: COLLATERAL_B,
        }),
      ],
    });
    const dest = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL_B,
    });

    const groups = groupTokensByCollateral([origin, dest]);
    expect(checkTokenHasRoute(origin, dest, groups)).toBe(true);
  });

  test('should return true when a later same-chain connection matches dest collateral', () => {
    const origin = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL_A,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          addressOrDenom: '0x3333333333333333333333333333333333333333',
          // First same-chain connection points to a different collateral
          collateralAddressOrDenom: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        }),
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          addressOrDenom: ADDR_2,
          // Second same-chain connection is the intended collateral
          collateralAddressOrDenom: COLLATERAL_B,
        }),
      ],
    });
    const dest = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL_B,
    });

    const groups = groupTokensByCollateral([origin, dest]);
    expect(checkTokenHasRoute(origin, dest, groups)).toBe(true);
  });

  test('should return false when no connection to dest chain', () => {
    const origin = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL_A,
      connections: [],
    });
    const dest = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL_B,
    });

    const groups = groupTokensByCollateral([origin, dest]);
    expect(checkTokenHasRoute(origin, dest, groups)).toBe(false);
  });

  test('should return true when connection exists with same address but different collateral keys', () => {
    // Even though collateral keys differ, the connection exists (same addressOrDenom),
    // so findConnectedDestinationToken matches via address fallback — route is valid.
    const origin = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL_A,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          addressOrDenom: ADDR_2,
          collateralAddressOrDenom: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        }),
      ],
    });
    const dest = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL_B,
    });

    const groups = groupTokensByCollateral([origin, dest]);
    expect(checkTokenHasRoute(origin, dest, groups)).toBe(true);
  });

  test('should return false when origin token not in any collateral group', () => {
    const origin = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL_A,
    });
    const dest = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL_B,
    });

    // Empty groups — origin not present
    const groups = new Map();
    expect(checkTokenHasRoute(origin, dest, groups)).toBe(false);
  });

  test('should find route through another token in the same collateral group', () => {
    // originDeduped has no connections (it was deduplicated)
    const originDeduped = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL_A,
      connections: [],
    });
    // originWithRoute shares collateral and has the actual connection
    const originWithRoute = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: '0x4444444444444444444444444444444444444444',
      collateralAddressOrDenom: COLLATERAL_A,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          addressOrDenom: ADDR_2,
          collateralAddressOrDenom: COLLATERAL_B,
        }),
      ],
    });
    const dest = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL_B,
    });

    const groups = groupTokensByCollateral([originDeduped, originWithRoute, dest]);
    expect(checkTokenHasRoute(originDeduped, dest, groups)).toBe(true);
  });
});

describe('checkTokenPickerHasRoute', () => {
  test('should not mark origin unavailable when another destination is routable', () => {
    const routableDestination = createMockToken({
      chainName: TestChainName.test2,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    });
    const origin = createMockToken({
      chainName: TestChainName.test1,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      connections: [createTokenConnectionMock(undefined, routableDestination)],
    });
    const currentDefaultDestination = createMockToken({
      chainName: 'base',
      symbol: 'USDC',
      addressOrDenom: '0x3333333333333333333333333333333333333333',
      collateralAddressOrDenom: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    });
    const groups = groupTokensByCollateral([
      origin,
      routableDestination,
      currentDefaultDestination,
    ]);

    expect(checkTokenPairHasRoute(origin, currentDefaultDestination, 'origin', groups)).toBe(false);

    expect(
      checkTokenPickerHasRoute(
        origin,
        currentDefaultDestination,
        'origin',
        [origin, routableDestination, currentDefaultDestination],
        groups,
      ),
    ).toBe(true);
  });

  test('should mark origin unavailable when it has no routes to any listed destination', () => {
    const isolatedOrigin = createMockToken({
      chainName: TestChainName.test1,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    const otherListed = createMockToken({
      chainName: TestChainName.test2,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    });
    const counterpart = createMockToken({
      chainName: 'base',
      symbol: 'USDC',
      addressOrDenom: '0x3333333333333333333333333333333333333333',
      collateralAddressOrDenom: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    });
    const groups = groupTokensByCollateral([isolatedOrigin, otherListed, counterpart]);

    expect(
      checkTokenPickerHasRoute(
        isolatedOrigin,
        counterpart,
        'origin',
        [isolatedOrigin, otherListed, counterpart],
        groups,
      ),
    ).toBe(false);
  });

  test('origin mode skips same-chain peers when checking routability', () => {
    // Two tokens on the same chain, both with no cross-chain connections.
    // The picker-level same-chain filter should reject the peer outright,
    // not rely on checkTokenHasRoute for the rejection.
    const origin = createMockToken({
      chainName: TestChainName.test1,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    const sameChainPeer = createMockToken({
      chainName: TestChainName.test1,
      symbol: 'PEER',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    });
    const groups = groupTokensByCollateral([origin, sameChainPeer]);

    expect(checkTokenPickerHasRoute(origin, null, 'origin', [origin, sameChainPeer], groups)).toBe(
      false,
    );
  });

  test('destination mode with a null counterpart returns false', () => {
    const token = createMockToken({
      chainName: TestChainName.test1,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
    });
    const groups = groupTokensByCollateral([token]);

    expect(checkTokenPickerHasRoute(token, null, 'destination', [token], groups)).toBe(false);
    expect(checkTokenPickerHasRoute(token, undefined, 'destination', [token], groups)).toBe(false);
  });

  test('origin mode resolves based on allTokens when counterpart is null', () => {
    const routableDestination = createMockToken({
      chainName: TestChainName.test2,
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    });
    const origin = createMockToken({
      chainName: TestChainName.test1,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      connections: [createTokenConnectionMock(undefined, routableDestination)],
    });
    const groups = groupTokensByCollateral([origin, routableDestination]);

    expect(
      checkTokenPickerHasRoute(origin, null, 'origin', [origin, routableDestination], groups),
    ).toBe(true);
    expect(
      checkTokenPickerHasRoute(origin, undefined, 'origin', [origin, routableDestination], groups),
    ).toBe(true);
  });

  test('should keep destination selection strict to current origin', () => {
    const origin = createMockToken({
      chainName: TestChainName.test1,
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: TestChainName.test2,
          addressOrDenom: '0x2222222222222222222222222222222222222222',
        }),
      ],
    });
    const unsupportedDestination = createMockToken({
      chainName: 'base',
      symbol: 'USDC',
      addressOrDenom: '0x3333333333333333333333333333333333333333',
      collateralAddressOrDenom: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    });
    const groups = groupTokensByCollateral([origin, unsupportedDestination]);

    expect(
      checkTokenPickerHasRoute(
        unsupportedDestination,
        origin,
        'destination',
        [origin, unsupportedDestination],
        groups,
      ),
    ).toBe(false);
  });
});

describe('getDefaultTokens', () => {
  test('should keep default list gated by featured tokens and strict current-pair routes', () => {
    const featured = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: '0x1111111111111111111111111111111111111111',
    });
    const strictRoutable = createMockToken({
      chainName: 'base',
      symbol: 'USDC',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
    });
    const pickerOnlyRoutable = createMockToken({
      chainName: 'fluent',
      symbol: 'BLEND',
      addressOrDenom: '0x3333333333333333333333333333333333333333',
    });
    const strictRouteMap = new Map([
      [getTokenKey(strictRoutable), true],
      [getTokenKey(pickerOnlyRoutable), false],
    ]);

    expect(
      getDefaultTokens(
        [featured, strictRoutable, pickerOnlyRoutable],
        ['ethereum-USDC'],
        strictRouteMap,
      ),
    ).toEqual([featured, strictRoutable]);
  });
});

describe('findRouteToken', () => {
  const ADDR_1 = '0x1111111111111111111111111111111111111111';
  const ADDR_2 = '0x2222222222222222222222222222222222222222';
  const ADDR_3 = '0x3333333333333333333333333333333333333333';
  const ADDR_4 = '0x4444444444444444444444444444444444444444';
  const ADDR_5 = '0x5555555555555555555555555555555555555555';
  const ADDR_6 = '0x6666666666666666666666666666666666666666';
  const COLLATERAL = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const COLLATERAL_B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

  const createMockWarpCore = (routeTokens: ReturnType<typeof createMockToken>[]) =>
    ({
      getTokensForRoute: vi.fn().mockReturnValue(routeTokens),
    }) as unknown as WarpCore;

  test('should return originToken if it already has the matching connection', () => {
    const destToken = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL,
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          addressOrDenom: ADDR_2,
          collateralAddressOrDenom: COLLATERAL,
        }),
      ],
    });
    const warpCore = createMockWarpCore([]);

    const result = findRouteToken(warpCore, origin, destToken);

    expect(result).toBe(origin);
    expect(warpCore.getTokensForRoute).not.toHaveBeenCalled();
  });

  test('should prefer route token that matches specific destination token on same chain', () => {
    const destinationCollateralA = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const destinationCollateralB = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const origin = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          addressOrDenom: ADDR_2,
          collateralAddressOrDenom: destinationCollateralA,
        }),
      ],
    });
    const selectedDestination = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_3,
      collateralAddressOrDenom: destinationCollateralB,
    });
    const routeToken = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: '0x4444444444444444444444444444444444444444',
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          addressOrDenom: ADDR_3,
          collateralAddressOrDenom: destinationCollateralB,
        }),
      ],
    });
    const warpCore = createMockWarpCore([routeToken]);

    const result = findRouteToken(warpCore, origin, selectedDestination);

    expect(result).toBe(routeToken);
  });

  test('should return undefined when no routes exist', () => {
    const destToken = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_2,
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      connections: [],
    });
    const warpCore = createMockWarpCore([]);

    const result = findRouteToken(warpCore, origin, destToken);

    expect(result).toBeUndefined();
  });

  test('should match by collateral address', () => {
    const destToken = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_3,
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL,
      connections: [],
    });
    const routeToken = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_3 }),
      ],
    });
    const warpCore = createMockWarpCore([routeToken]);

    const result = findRouteToken(warpCore, origin, destToken);

    expect(result).toBe(routeToken);
  });

  test('should match by symbol when no collateral address', () => {
    const destToken = createMockToken({
      chainName: 'arbitrum',
      symbol: 'ETH',
      standard: TokenStandard.EvmHypNative,
      addressOrDenom: ADDR_3,
      collateralAddressOrDenom: undefined,
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      symbol: 'ETH',
      standard: TokenStandard.EvmHypNative,
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: undefined,
      connections: [],
    });
    const routeToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'ETH',
      standard: TokenStandard.EvmHypNative,
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: undefined,
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_3 }),
      ],
    });
    const warpCore = createMockWarpCore([routeToken]);

    const result = findRouteToken(warpCore, origin, destToken);

    expect(result).toBe(routeToken);
  });

  test('should return undefined when no collateral or symbol match', () => {
    const destToken = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_3,
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL,
      connections: [],
    });
    const routeToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'WETH',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_3 }),
      ],
    });
    const warpCore = createMockWarpCore([routeToken]);

    const result = findRouteToken(warpCore, origin, destToken);

    // No collateral or symbol match — should not blindly pick first token
    expect(result).toBeUndefined();
  });

  test('should match lockbox token via resolved collateral key, not symbol fallback', () => {
    const UNDERLYING_USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const LOCKBOX_WRAPPER = '0x6D265C7dD8d76F25155F1a7687C693FDC1220D12';
    const WRONG_COLLATERAL = '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';

    const destToken = createMockToken({
      chainName: 'optimism',
      symbol: 'USDT',
      addressOrDenom: ADDR_3,
      collateralAddressOrDenom: UNDERLYING_USDT,
    });
    // Regular USDT (displayed, no connection to optimism)
    const origin = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: UNDERLYING_USDT,
      connections: [],
    });
    // Lockbox USDT — resolved collateral matches origin
    const lockboxToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypXERC20Lockbox,
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: LOCKBOX_WRAPPER,
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'optimism', addressOrDenom: ADDR_3 }),
      ],
    });
    // Decoy: same symbol but wrong collateral — symbol fallback would pick this
    const decoyToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      addressOrDenom: ADDR_5,
      collateralAddressOrDenom: WRONG_COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'optimism',
          addressOrDenom: ADDR_6,
        }),
      ],
    });

    // Set resolved map: lockbox wrapper resolves to real USDT
    const resolvedMap = new Map([[getTokenKey(lockboxToken), UNDERLYING_USDT.toLowerCase()]]);
    setResolvedUnderlyingMap(resolvedMap);

    // Decoy listed first — if symbol fallback ran first, it would pick decoy
    const warpCore = createMockWarpCore([decoyToken, lockboxToken]);
    const result = findRouteToken(warpCore, origin, destToken);

    // Must pick lockbox (collateral key match), not decoy (symbol match)
    expect(result).toBe(lockboxToken);
  });

  test('should match OwnerCollateral token via resolved collateral key, not symbol fallback', () => {
    const UNDERLYING_USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const VAULT_ADDRESS = '0x04DA4b99FFc82f0e44DEd14c3539A6fDaD08E2fE';
    const WRONG_COLLATERAL = '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';

    const destToken = createMockToken({
      chainName: 'incentiv',
      symbol: 'USDT',
      addressOrDenom: ADDR_3,
      collateralAddressOrDenom: UNDERLYING_USDT,
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: UNDERLYING_USDT,
      connections: [],
    });
    // Vault token — resolved collateral matches origin
    const vaultToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypOwnerCollateral,
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: VAULT_ADDRESS,
      connections: [
        createTokenConnectionMock(undefined, { chainName: 'incentiv', addressOrDenom: ADDR_3 }),
      ],
    });
    // Decoy: same symbol but wrong collateral
    const decoyToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      addressOrDenom: ADDR_5,
      collateralAddressOrDenom: WRONG_COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'incentiv',
          addressOrDenom: ADDR_6,
        }),
      ],
    });

    const resolvedMap = new Map([[getTokenKey(vaultToken), UNDERLYING_USDT.toLowerCase()]]);
    setResolvedUnderlyingMap(resolvedMap);

    // Decoy listed first — symbol fallback would pick it
    const warpCore = createMockWarpCore([decoyToken, vaultToken]);
    const result = findRouteToken(warpCore, origin, destToken);

    // Must pick vault (collateral key match), not decoy
    expect(result).toBe(vaultToken);
  });

  // --- Multi-collateral disambiguation tests (USDC->USDC vs USDC->XO bug) ---

  test('should not return origin when it has a connection to the chain but wrong destination collateral', () => {
    // Origin (deduped USDC) has a connection to solanamainnet -> standard USDC
    // But user selected XO Cash (different collateral) as destination
    const xoCashDest = createMockToken({
      chainName: 'solanamainnet',
      symbol: 'XO',
      name: 'XO Cash',
      addressOrDenom: ADDR_4,
      collateralAddressOrDenom: COLLATERAL_B, // XO collateral
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        // This connection goes to standard USDC on solanamainnet, NOT XO Cash
        createTokenConnectionMock(undefined, {
          chainName: 'solanamainnet',
          symbol: 'USDC',
          addressOrDenom: ADDR_3,
          collateralAddressOrDenom: COLLATERAL, // standard USDC collateral
        }),
      ],
    });
    // The correct route token connects to XO Cash
    const xoRouteToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'solanamainnet',
          symbol: 'XO',
          addressOrDenom: ADDR_4,
          collateralAddressOrDenom: COLLATERAL_B,
        }),
      ],
    });
    const warpCore = createMockWarpCore([origin, xoRouteToken]);

    const result = findRouteToken(warpCore, origin, xoCashDest);

    // Must NOT return origin (wrong destination), must find xoRouteToken
    expect(result).toBe(xoRouteToken);
    expect(result).not.toBe(origin);
  });

  test('should pick correct route among multiple collateral matches by destination token', () => {
    // Two route tokens on ethereum with same USDC collateral, each connecting
    // to different tokens on solanamainnet
    const standardUsdcDest = createMockToken({
      chainName: 'solanamainnet',
      symbol: 'USDC',
      addressOrDenom: ADDR_3,
      collateralAddressOrDenom: COLLATERAL,
    });
    const xoCashDest = createMockToken({
      chainName: 'solanamainnet',
      symbol: 'XO',
      addressOrDenom: ADDR_4,
      collateralAddressOrDenom: COLLATERAL_B,
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL,
      connections: [],
    });
    const usdcRoute = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'solanamainnet',
          symbol: 'USDC',
          addressOrDenom: ADDR_3,
          collateralAddressOrDenom: COLLATERAL,
        }),
      ],
    });
    const xoRoute = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_5,
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'solanamainnet',
          symbol: 'XO',
          addressOrDenom: ADDR_4,
          collateralAddressOrDenom: COLLATERAL_B,
        }),
      ],
    });

    // USDC route listed first — without fix, .find() would always pick it
    const warpCore = createMockWarpCore([usdcRoute, xoRoute]);

    // Selecting XO Cash as destination should pick xoRoute
    const resultXo = findRouteToken(warpCore, origin, xoCashDest);
    expect(resultXo).toBe(xoRoute);

    // Selecting standard USDC as destination should pick usdcRoute
    const resultUsdc = findRouteToken(warpCore, origin, standardUsdcDest);
    expect(resultUsdc).toBe(usdcRoute);
  });

  test('should work with synthetic (non-collateral) destination tokens', () => {
    // Origin is collateral on ethereum, destination is synthetic on arbitrum
    const syntheticDest = createMockToken({
      chainName: 'arbitrum',
      symbol: 'USDC',
      standard: TokenStandard.EvmHypSynthetic,
      addressOrDenom: ADDR_3,
      collateralAddressOrDenom: undefined,
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL,
      connections: [],
    });
    const routeToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          symbol: 'USDC',
          standard: TokenStandard.EvmHypSynthetic,
          addressOrDenom: ADDR_3,
          collateralAddressOrDenom: undefined,
        }),
      ],
    });
    const warpCore = createMockWarpCore([routeToken]);

    const result = findRouteToken(warpCore, origin, syntheticDest);

    expect(result).toBe(routeToken);
  });

  test('should disambiguate when origin has synthetic connection but user wants collateral dest', () => {
    // Origin has connection to synthetic USDC on arbitrum
    // But user selected a collateral USDC on arbitrum (different route)
    const collateralDest = createMockToken({
      chainName: 'arbitrum',
      symbol: 'USDC',
      addressOrDenom: ADDR_4,
      collateralAddressOrDenom: COLLATERAL_B,
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        // Existing connection goes to synthetic
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          symbol: 'USDC',
          standard: TokenStandard.EvmHypSynthetic,
          addressOrDenom: ADDR_3,
          collateralAddressOrDenom: undefined,
        }),
      ],
    });
    // Route token that connects to the collateral destination
    const collateralRoute = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          symbol: 'USDC',
          addressOrDenom: ADDR_4,
          collateralAddressOrDenom: COLLATERAL_B,
        }),
      ],
    });
    const warpCore = createMockWarpCore([origin, collateralRoute]);

    const result = findRouteToken(warpCore, origin, collateralDest);

    // Must not return origin (its connection is synthetic, not the collateral dest)
    expect(result).toBe(collateralRoute);
  });

  test('should return origin when its connection matches the destination collateral', () => {
    // Origin already has the right connection — should short-circuit
    const dest = createMockToken({
      chainName: 'arbitrum',
      symbol: 'USDC',
      addressOrDenom: ADDR_3,
      collateralAddressOrDenom: COLLATERAL_B,
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          symbol: 'USDC',
          addressOrDenom: ADDR_3,
          collateralAddressOrDenom: COLLATERAL_B,
        }),
      ],
    });
    const warpCore = createMockWarpCore([]);

    const result = findRouteToken(warpCore, origin, dest);

    expect(result).toBe(origin);
    expect(warpCore.getTokensForRoute).not.toHaveBeenCalled();
  });

  test('should handle single collateral match connecting to correct synthetic dest', () => {
    // Only one route token exists, connects to synthetic — should return it
    const syntheticDest = createMockToken({
      chainName: 'arbitrum',
      symbol: 'USDC',
      standard: TokenStandard.EvmHypSynthetic,
      addressOrDenom: ADDR_3,
      collateralAddressOrDenom: undefined,
    });
    const origin = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: COLLATERAL,
      connections: [],
    });
    const routeToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          symbol: 'USDC',
          standard: TokenStandard.EvmHypSynthetic,
          addressOrDenom: ADDR_3,
          collateralAddressOrDenom: undefined,
        }),
      ],
    });
    const warpCore = createMockWarpCore([routeToken]);

    const result = findRouteToken(warpCore, origin, syntheticDest);

    expect(result).toBe(routeToken);
  });
});

describe('resolved underlying map integration', () => {
  const UNDERLYING = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const WRAPPER = '0x6D265C7dD8d76F25155F1a7687C693FDC1220D12';
  const ADDR_1 = '0x1111111111111111111111111111111111111111';
  const ADDR_2 = '0x2222222222222222222222222222222222222222';
  const ADDR_3 = '0x3333333333333333333333333333333333333333';

  test('dedupeTokensByCollateral should dedup lockbox against regular collateral', () => {
    const regularUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: UNDERLYING,
    });
    const lockboxUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypXERC20Lockbox,
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: WRAPPER,
    });

    // Without resolved map: both survive (different collateral addresses)
    expect(dedupeTokensByCollateral([regularUsdt, lockboxUsdt])).toHaveLength(2);

    // With resolved map: lockbox resolves to same underlying, gets deduped
    const resolvedMap = new Map([[getTokenKey(lockboxUsdt), UNDERLYING.toLowerCase()]]);
    setResolvedUnderlyingMap(resolvedMap);

    const result = dedupeTokensByCollateral([regularUsdt, lockboxUsdt]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(regularUsdt);
  });

  test('dedupeTokensByCollateral should dedup VSXERC20Lockbox against regular collateral', () => {
    const regularUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: UNDERLYING,
    });
    const vsLockboxUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypVSXERC20Lockbox,
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: WRAPPER,
    });

    const resolvedMap = new Map([[getTokenKey(vsLockboxUsdt), UNDERLYING.toLowerCase()]]);
    setResolvedUnderlyingMap(resolvedMap);

    const result = dedupeTokensByCollateral([regularUsdt, vsLockboxUsdt]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(regularUsdt);
  });

  test('dedupeTokensByCollateral should dedup OwnerCollateral against regular collateral', () => {
    const regularUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: UNDERLYING,
    });
    const vaultUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypOwnerCollateral,
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: WRAPPER,
    });

    const resolvedMap = new Map([[getTokenKey(vaultUsdt), UNDERLYING.toLowerCase()]]);
    setResolvedUnderlyingMap(resolvedMap);

    const result = dedupeTokensByCollateral([regularUsdt, vaultUsdt]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(regularUsdt);
  });

  test('dedupeTokensByCollateral should keep lockbox if no regular counterpart exists', () => {
    const lockboxUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypXERC20Lockbox,
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: WRAPPER,
    });

    const resolvedMap = new Map([[getTokenKey(lockboxUsdt), UNDERLYING.toLowerCase()]]);
    setResolvedUnderlyingMap(resolvedMap);

    const result = dedupeTokensByCollateral([lockboxUsdt]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(lockboxUsdt);
  });

  test('groupTokensByCollateral should group lockbox with regular collateral', () => {
    const regularUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: UNDERLYING,
    });
    const lockboxUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypXERC20Lockbox,
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: WRAPPER,
    });

    // Without resolved map: separate groups
    const groupsBefore = groupTokensByCollateral([regularUsdt, lockboxUsdt]);
    expect(groupsBefore.size).toBe(2);

    // With resolved map: same group
    const resolvedMap = new Map([[getTokenKey(lockboxUsdt), UNDERLYING.toLowerCase()]]);
    setResolvedUnderlyingMap(resolvedMap);

    const groupsAfter = groupTokensByCollateral([regularUsdt, lockboxUsdt]);
    expect(groupsAfter.size).toBe(1);
    const group = Array.from(groupsAfter.values())[0];
    expect(group).toHaveLength(2);
    expect(group).toContain(regularUsdt);
    expect(group).toContain(lockboxUsdt);
  });

  test('checkTokenHasRoute should find route via lockbox in same collateral group', () => {
    const regularUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: UNDERLYING,
      connections: [], // no direct connection to optimism
    });
    const lockboxUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypXERC20Lockbox,
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: WRAPPER,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'optimism',
          symbol: 'USDT',
          addressOrDenom: ADDR_3,
          collateralAddressOrDenom: UNDERLYING,
        }),
      ],
    });
    const destToken = createMockToken({
      chainName: 'optimism',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ADDR_3,
      collateralAddressOrDenom: UNDERLYING,
    });

    const resolvedMap = new Map([[getTokenKey(lockboxUsdt), UNDERLYING.toLowerCase()]]);
    setResolvedUnderlyingMap(resolvedMap);

    const groups = groupTokensByCollateral([regularUsdt, lockboxUsdt, destToken]);
    // regularUsdt has no connection, but lockboxUsdt in same group does
    expect(checkTokenHasRoute(regularUsdt, destToken, groups)).toBe(true);
  });

  test('checkTokenHasRoute should return false when no resolved route exists', () => {
    const regularUsdt = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ADDR_1,
      collateralAddressOrDenom: UNDERLYING,
      connections: [],
    });
    const destToken = createMockToken({
      chainName: 'optimism',
      symbol: 'USDT',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ADDR_3,
      collateralAddressOrDenom: UNDERLYING,
    });

    // No lockbox token, no connection — should be false
    const groups = groupTokensByCollateral([regularUsdt, destToken]);
    expect(checkTokenHasRoute(regularUsdt, destToken, groups)).toBe(false);
  });
});

describe('findConnectedDestinationToken', () => {
  test('should match later same-chain connection by collateral key', () => {
    const COLLATERAL_A = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const COLLATERAL_B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const origin = createMockToken({
      chainName: 'ethereum',
      collateralAddressOrDenom: COLLATERAL_A,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          addressOrDenom: '0x1111111111111111111111111111111111111111',
          collateralAddressOrDenom: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        }),
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          addressOrDenom: '0x2222222222222222222222222222222222222222',
          collateralAddressOrDenom: COLLATERAL_B,
        }),
      ],
    });
    const selectedDestination = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: '0x3333333333333333333333333333333333333333',
      collateralAddressOrDenom: COLLATERAL_B,
    });

    const matched = findConnectedDestinationToken(origin, selectedDestination);
    expect(matched?.addressOrDenom).toBe('0x2222222222222222222222222222222222222222');
  });

  test('should return undefined when there is no destination-chain connection', () => {
    const origin = createMockToken({
      chainName: 'ethereum',
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'optimism',
        }),
      ],
    });
    const selectedDestination = createMockToken({ chainName: 'arbitrum' });

    const matched = findConnectedDestinationToken(origin, selectedDestination);
    expect(matched).toBeUndefined();
  });

  // --- M0 Portal case: multiple synthetic tokens share the same addressOrDenom ---
  // wM, USDSC, USDnr on ethereum all use portal contract 0xD925... but wrap
  // different collaterals and have different symbols. Address alone cannot
  // identify a token — symbol must match too.
  test('should NOT match via address fallback when symbol differs (M0Portal case)', () => {
    const M0_PORTAL_ADDR = '0xD925C84b55E4e44a53749fF5F2a5A13F63D128fd';
    const WM_COLLATERAL = '0x437cc33344a0B27A429f795ff6B469C72698B291';
    const USDSC_COLLATERAL = '0x3f99231dD03a9F0E7e3421c92B7b90fbe012985a';

    // Origin is wM on ethereum, connected to wM on soneium (same portal addr)
    const wmOrigin = createMockToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_PORTAL_ADDR,
      collateralAddressOrDenom: WM_COLLATERAL,
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'soneium',
          symbol: 'wM',
          standard: TokenStandard.EvmM0Portal,
          addressOrDenom: M0_PORTAL_ADDR,
          collateralAddressOrDenom: WM_COLLATERAL,
        }),
      ],
    });
    // User selects USDSC on soneium — same portal addr, different symbol/collateral
    const usdscDestination = createMockToken({
      chainName: 'soneium',
      symbol: 'USDSC',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_PORTAL_ADDR,
      collateralAddressOrDenom: USDSC_COLLATERAL,
    });

    // Must not impersonate USDSC via shared addressOrDenom
    expect(findConnectedDestinationToken(wmOrigin, usdscDestination)).toBeUndefined();
  });

  test('should still match via address fallback when symbol matches', () => {
    // Control case: when symbols match, address fallback is still valid
    // (e.g. a single route between two chains with same addressOrDenom).
    const ADDR = '0x1111111111111111111111111111111111111111';
    const CONN_COLLATERAL = '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
    const DEST_COLLATERAL = '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';

    const origin = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: 'arbitrum',
          symbol: 'USDC',
          addressOrDenom: ADDR,
          collateralAddressOrDenom: CONN_COLLATERAL,
        }),
      ],
    });
    // Same address + same symbol, but different collateral key — address fallback should match
    const destination = createMockToken({
      chainName: 'arbitrum',
      symbol: 'USDC',
      addressOrDenom: ADDR,
      collateralAddressOrDenom: DEST_COLLATERAL,
    });

    expect(findConnectedDestinationToken(origin, destination)?.addressOrDenom).toBe(ADDR);
  });
});

describe('M0Portal integration (multi-synthetic same addressOrDenom)', () => {
  const M0_HUB = '0xD925C84b55E4e44a53749fF5F2a5A13F63D128fd';
  const M0_LITE = '0x36f586A30502AE3afb555b8aA4dCc05d233c2ecE';
  const WM_COLLATERAL = '0x437cc33344a0B27A429f795ff6B469C72698B291';
  const USDSC_COLLATERAL = '0x3f99231dD03a9F0E7e3421c92B7b90fbe012985a';
  const USDNR_COLLATERAL = '0xD48e565561416dE59DA1050ED70b8d75e8eF28f9';

  test('dedupeTokensByCollateral should collapse M0Portal tokens sharing collateral on same chain', () => {
    // Two wM ethereum definitions (one EvmM0Portal, one EvmM0PortalLite) with different
    // addresses but SAME collateral — these are the real wM dupes that should collapse.
    const wmHub = createMockToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: WM_COLLATERAL,
    });
    const wmLite = createMockToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0PortalLite,
      addressOrDenom: M0_LITE,
      collateralAddressOrDenom: WM_COLLATERAL,
    });

    // Which variant survives doesn't matter — findRouteToken resolves the correct
    // variant at transfer time. Ordering is covered by the dedicated test above.
    const result = dedupeTokensByCollateral([wmHub, wmLite]);
    expect(result).toHaveLength(1);
  });

  test('dedupeTokensByCollateral should NOT collapse M0Portal tokens with different symbols/collaterals', () => {
    // wM, USDSC, USDnr all share the SAME addressOrDenom on ethereum but wrap
    // different collaterals. They must remain distinct.
    const wm = createMockToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: WM_COLLATERAL,
    });
    const usdsc = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDSC',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: USDSC_COLLATERAL,
    });
    const usdnr = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDnr',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: USDNR_COLLATERAL,
    });

    const result = dedupeTokensByCollateral([wm, usdsc, usdnr]);
    expect(result).toHaveLength(3);
    expect(result).toContain(wm);
    expect(result).toContain(usdsc);
    expect(result).toContain(usdnr);
  });

  test('findRouteToken should pick correct M0Portal token by destination chain connectivity', () => {
    // wM on ethereum routes to mantra (via EvmM0Portal) and bsc (via EvmM0PortalLite).
    // When user picks origin=wM ethereum + destination=wM bsc, findRouteToken must
    // return the Lite variant (only one with a bsc connection).
    const wmMantraConn = {
      chainName: 'mantra',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: WM_COLLATERAL,
    };
    const wmBscConn = {
      chainName: 'bsc',
      symbol: 'wM',
      standard: TokenStandard.EvmM0PortalLite,
      addressOrDenom: M0_LITE,
      collateralAddressOrDenom: WM_COLLATERAL,
    };

    // Origin displayed in UI is the Hub variant (survives dedup)
    const wmHubEth = createMockToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: WM_COLLATERAL,
      connections: [createTokenConnectionMock(undefined, wmMantraConn)],
    });
    // Lite variant exists in WarpCore with the bsc connection
    const wmLiteEth = createMockToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0PortalLite,
      addressOrDenom: M0_LITE,
      collateralAddressOrDenom: WM_COLLATERAL,
      connections: [createTokenConnectionMock(undefined, wmBscConn)],
    });

    const wmBscDest = createMockToken(wmBscConn);

    const warpCore = {
      getTokensForRoute: vi.fn().mockReturnValue([wmLiteEth]),
    } as unknown as WarpCore;

    const result = findRouteToken(warpCore, wmHubEth, wmBscDest);
    expect(result).toBe(wmLiteEth);
  });

  test('checkTokenHasRoute should reject wM origin -> USDSC dest (different symbols, shared portal addr)', () => {
    // Origin wM ethereum connected to wM soneium (same addressOrDenom as USDSC soneium!).
    // User selects USDSC soneium as dest — the symbol mismatch must block the route.
    const wmSoneiumConn = {
      chainName: 'soneium',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: WM_COLLATERAL,
    };
    const wmEth = createMockToken({
      chainName: 'ethereum',
      symbol: 'wM',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: WM_COLLATERAL,
      connections: [createTokenConnectionMock(undefined, wmSoneiumConn)],
    });

    const usdscSoneium = createMockToken({
      chainName: 'soneium',
      symbol: 'USDSC',
      standard: TokenStandard.EvmM0Portal,
      addressOrDenom: M0_HUB,
      collateralAddressOrDenom: USDSC_COLLATERAL,
    });

    // Collateral groups built from full warpCore.tokens (not UI-deduped)
    const groups = groupTokensByCollateral([wmEth, usdscSoneium]);

    // wmEth's only connection is wM soneium (same address as USDSC soneium but
    // different symbol/collateral). Pre-fix this would falsely match via address.
    expect(checkTokenHasRoute(wmEth, usdscSoneium, groups)).toBe(false);
  });
});
