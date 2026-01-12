import { TestChainName, TokenStandard } from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockToken, createTokenConnectionMock } from '../../utils/test';
import { isValidMultiCollateralToken, tryGetDefaultOriginToken } from './utils';

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
