<<<<<<< HEAD
import { TestChainName, TokenStandard } from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockToken, createTokenConnectionMock } from '../../utils/test';
import { isValidMultiCollateralToken } from './utils';

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

  test('should return false if destinationToken has no collateralAddressOrDenom and is not HypNative', () => {
    const token = createMockToken({
      connections: [
        createTokenConnectionMock(undefined, {
          collateralAddressOrDenom: undefined,
          standard: TokenStandard.EvmHypCollateral,
        }),
      ],
    });
    expect(isValidMultiCollateralToken(token, TestChainName.test2)).toBe(false);
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
      connections: [createTokenConnectionMock(undefined, { standard: TokenStandard.CosmosIbc })],
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
=======
import { describe, expect, test } from 'vitest';

import { getAvailableRoutesQuery, isBridgeOnlyToken } from './hooks';
import type { UiToken } from './types';
import { getRoutePrefillToken, getTokenRouteKind, mergeRouteTokensFirst, tokenKey } from './utils';

describe('tokenKey', () => {
  test('lowercases EVM addresses', () => {
    expect(tokenKey(1, '0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48')).toBe(
      '1-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
  });

  test('preserves non-EVM token casing', () => {
    expect(tokenKey(101, 'So11111111111111111111111111111111111111112')).toBe(
      '101-So11111111111111111111111111111111111111112',
    );
  });
});

describe('mergeRouteTokensFirst', () => {
  test('prepends route tokens and dedupes matching catalogue tokens', () => {
    const routeToken = token(8453, '0x1111111111111111111111111111111111111111', 'base');
    const normalToken = token(1, '0x2222222222222222222222222222222222222222', 'ethereum');

    expect(mergeRouteTokensFirst([routeToken], [normalToken, { ...routeToken }])).toEqual([
      routeToken,
      normalToken,
    ]);
  });

  test('preserves non-EVM token casing while deduping', () => {
    const routeToken = token(101, 'So11111111111111111111111111111111111111112', 'solana');

    expect(mergeRouteTokensFirst([routeToken], [{ ...routeToken }])).toEqual([routeToken]);
  });
});

describe('getTokenRouteKind', () => {
  test('marks direct available route tokens as bridge', () => {
    const routeToken = token(10, '0x1111111111111111111111111111111111111111', 'optimism');

    expect(
      getTokenRouteKind(
        routeToken,
        new Set([tokenKey(routeToken.chainId, routeToken.address)]),
        token(1, '0x5555555555555555555555555555555555555555', 'ethereum'),
      ),
    ).toBe('bridge');
  });

  test('marks tokens as swap when both sides can swap', () => {
    const swapToken = token(10, '0x2222222222222222222222222222222222222222', 'optimism', {
      canBridge: false,
      isBridgeToken: false,
      canSwap: true,
    });
    const counterpartToken = token(1, '0x5555555555555555555555555555555555555555', 'ethereum', {
      canSwap: true,
    });

    expect(getTokenRouteKind(swapToken, new Set(), counterpartToken)).toBe('swap');
  });

  test('does not badge unsupported tokens', () => {
    const unsupported = token(10, '0x3333333333333333333333333333333333333333', 'optimism', {
      canBridge: false,
      isBridgeToken: false,
      canSwap: false,
    });

    expect(
      getTokenRouteKind(
        unsupported,
        new Set(),
        token(1, '0x5555555555555555555555555555555555555555', 'ethereum', {
          canSwap: true,
        }),
      ),
    ).toBeUndefined();
  });

  test('does not mark swap when the counterpart cannot swap', () => {
    const swapToken = token(42161, '0x4444444444444444444444444444444444444444', 'arbitrum', {
      canBridge: false,
      isBridgeToken: false,
      canSwap: true,
    });
    const counterpartToken = token(1, '0x5555555555555555555555555555555555555555', 'ethereum', {
      canSwap: false,
    });

    expect(getTokenRouteKind(swapToken, new Set(), counterpartToken)).toBeUndefined();
  });
});

describe('getRoutePrefillToken', () => {
  test('returns the first route token when no destination is selected', () => {
    const routeToken = token(10, '0x1111111111111111111111111111111111111111', 'optimism');

    expect(getRoutePrefillToken([routeToken])).toBe(routeToken);
  });

  test('keeps the current destination when it is still directly bridgeable', () => {
    const routeToken = token(10, '0x1111111111111111111111111111111111111111', 'optimism');

    expect(getRoutePrefillToken([routeToken], { ...routeToken })).toBeUndefined();
  });

  test('replaces the current destination when it is not directly bridgeable', () => {
    const routeToken = token(10, '0x1111111111111111111111111111111111111111', 'optimism');
    const current = token(42161, '0x2222222222222222222222222222222222222222', 'arbitrum');

    expect(getRoutePrefillToken([routeToken], current)).toBe(routeToken);
  });

  test('replaces a swap-only destination with the first direct bridge token', () => {
    const routeToken = token(10, '0x1111111111111111111111111111111111111111', 'optimism');
    const swapOnlyDestination = token(
      10,
      '0x2222222222222222222222222222222222222222',
      'optimism',
      {
        canBridge: false,
        isBridgeToken: false,
        canSwap: true,
      },
    );

    expect(getRoutePrefillToken([routeToken], swapOnlyDestination)).toBe(routeToken);
  });
});

describe('isBridgeOnlyToken', () => {
  test('requires bridge support without swap support', () => {
    expect(isBridgeOnlyToken(token(1, '0x1111111111111111111111111111111111111111', 'base'))).toBe(
      true,
    );
    expect(
      isBridgeOnlyToken(
        token(1, '0x1111111111111111111111111111111111111111', 'base', { canSwap: true }),
      ),
    ).toBe(false);
    expect(
      isBridgeOnlyToken(
        token(1, '0x1111111111111111111111111111111111111111', 'base', {
          canBridge: false,
          isBridgeToken: false,
        }),
      ),
    ).toBe(false);
  });
});

describe('getAvailableRoutesQuery', () => {
  test('builds destination route query from any origin token', () => {
    const originToken = token(1, '0x1111111111111111111111111111111111111111', 'ethereum', {
      canBridge: true,
      canSwap: true,
    });

    expect(getAvailableRoutesQuery('destination', originToken)).toEqual({
      srcChain: originToken.chainId,
      srcToken: originToken.address,
    });
  });

  test('builds origin route query from a selected destination token', () => {
    const destinationToken = token(10, '0x2222222222222222222222222222222222222222', 'optimism', {
      canBridge: false,
      canSwap: true,
    });

    expect(getAvailableRoutesQuery('origin', destinationToken)).toEqual({
      dstChain: destinationToken.chainId,
      dstToken: destinationToken.address,
    });
  });
});

function token(
  chainId: number,
  address: string,
  chainName: string,
  overrides: Partial<UiToken> = {},
): UiToken {
  return {
    chainId,
    address,
    chainName,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    isBridgeToken: true,
    isPoolToken: false,
    canBridge: true,
    canSwap: false,
    bridgeSymbols: ['USDC'],
    warpRouteIds: ['USDC/base'],
    addressOrDenom: address,
    ...overrides,
  };
}
>>>>>>> origin/main
