import { TestChainName, TokenStandard } from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockToken, createTokenConnectionMock } from '../../utils/test';
import {
  buildTokensArray,
  dedupeTokensByCollateral,
  isValidMultiCollateralToken,
  tryGetDefaultOriginToken,
} from './utils';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('isValidMultiCollateralToken', () => {
  test('should return false if originToken has no collateralAddressOrDenom and is not HypNative', () => {
    const token = createMockToken({
      collateralAddressOrDenom: undefined,
      standard: TokenStandard.EvmHypCollateral,
    });
    expect(isValidMultiCollateralToken(token, 'destination')).toBe(false);
  });

  test('should return true if originToken is HypNative even without collateralAddressOrDenom', () => {
    const token = createMockToken({
      collateralAddressOrDenom: undefined,
      standard: TokenStandard.EvmHypNative,
      connections: [
        createTokenConnectionMock(undefined, {
          standard: TokenStandard.EvmHypNative,
          collateralAddressOrDenom: undefined,
        }),
      ],
    });
    expect(isValidMultiCollateralToken(token, TestChainName.test2)).toBe(true);
  });

  test('should return false if originToken is not collateralized', () => {
    const token = createMockToken({ standard: TokenStandard.CosmosIbc });
    expect(isValidMultiCollateralToken(token, 'destination')).toBe(false);
  });

  test('should return false if destinationToken is not found via chain name', () => {
    const token = createMockToken({ connections: [createTokenConnectionMock()] });
    expect(isValidMultiCollateralToken(token, 'destination')).toBe(false);
  });

  test('should return true if destinationToken standard is in TOKEN_COLLATERALIZED_STANDARDS even without collateralAddressOrDenom', () => {
    const token = createMockToken({
      connections: [
        createTokenConnectionMock(undefined, {
          collateralAddressOrDenom: undefined,
          standard: TokenStandard.EvmHypCollateral,
        }),
      ],
    });
    // EvmHypCollateral is in TOKEN_COLLATERALIZED_STANDARDS, so this should return true
    expect(isValidMultiCollateralToken(token, TestChainName.test2)).toBe(true);
  });

  test('should return true if destinationToken is HypNative even without collateralAddressOrDenom', () => {
    const token = createMockToken({
      standard: TokenStandard.EvmHypNative,
      collateralAddressOrDenom: undefined,
      connections: [
        createTokenConnectionMock(undefined, {
          standard: TokenStandard.EvmHypNative,
          collateralAddressOrDenom: undefined,
        }),
      ],
    });
    const destinationToken = token.getConnectionForChain(TestChainName.test2)!.token;
    expect(isValidMultiCollateralToken(token, destinationToken)).toBe(true);
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
    expect(isValidMultiCollateralToken(token, TestChainName.test2)).toBe(false);
  });

  test('should return true when tokens are valid with destinationToken as a string', () => {
    const token = createMockToken({
      connections: [createTokenConnectionMock()],
    });
    expect(isValidMultiCollateralToken(token, TestChainName.test2)).toBe(true);
  });

  test('should return true when tokens are valid with destinationToken as a IToken', () => {
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
      connections: [createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_2 })],
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
      connections: [createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_2 })],
    });
    const token2 = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: ADDR_1,
      name: 'Second',
      connections: [createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_2 })],
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
      connections: [createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_3 })],
    });
    const token2 = createMockToken({
      chainName: 'optimism',
      addressOrDenom: ADDR_2,
      connections: [createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_3 })],
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
      connections: [createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_2 })],
    });
    const tokenB = createMockToken({
      chainName: 'arbitrum',
      addressOrDenom: ADDR_2,
      connections: [createTokenConnectionMock(undefined, { chainName: 'ethereum', addressOrDenom: ADDR_1 })],
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
      connections: [createTokenConnectionMock(undefined, { chainName: 'arbitrum', addressOrDenom: ADDR_3 })],
    });
    const token2 = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: ADDR_2,
      collateralAddressOrDenom: COLLATERAL_USDC,
      connections: [createTokenConnectionMock(undefined, { chainName: 'optimism', addressOrDenom: ADDR_3 })],
    });

    const result = buildTokensArray([token1, token2]);

    // Only 1 origin (deduped by collateral) + destinations
    const originTokens = result.filter((t) => t.chainName === 'ethereum');
    expect(originTokens).toHaveLength(1);
    expect(originTokens[0].addressOrDenom).toBe(ADDR_1);
  });
});
