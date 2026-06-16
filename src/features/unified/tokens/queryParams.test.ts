import { TokenStandard } from '@hyperlane-xyz/sdk';
import { describe, expect, test } from 'vitest';

import { createMockToken } from '../../../utils/test';
import type { UiToken } from '../../swap/tokens/types';
import { findUnifiedTokenByQueryRef, getUnifiedTokenQueryRef } from './queryParams';
import type { UnifiedToken } from './types';

function createSwapToken(args: Partial<UiToken> = {}): UiToken {
  return {
    chainId: 1,
    address: '0x1111111111111111111111111111111111111111',
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
    addressOrDenom: '0x1111111111111111111111111111111111111111',
    ...args,
  };
}

function createUnifiedToken(args: Partial<UnifiedToken> = {}): UnifiedToken {
  return {
    key: 'ethereum-usdc',
    chainName: 'ethereum',
    chainId: 1,
    addressOrDenom: '0x2222222222222222222222222222222222222222',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    capabilities: { bridge: false, swap: false },
    ...args,
  };
}

describe('getUnifiedTokenQueryRef', () => {
  test('uses swap token address when available', () => {
    expect(getUnifiedTokenQueryRef(createUnifiedToken({ swapToken: createSwapToken() }))).toBe(
      '0x1111111111111111111111111111111111111111',
    );
  });

  test('uses bridge collateral address when available', () => {
    const bridgeToken = createMockToken({
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x3333333333333333333333333333333333333333',
    });
    expect(getUnifiedTokenQueryRef(createUnifiedToken({ bridgeToken }))).toBe(
      '0x3333333333333333333333333333333333333333',
    );
  });

  test('uses bridge addressOrDenom when collateral address is unavailable', () => {
    const bridgeToken = createMockToken({
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: undefined,
    });
    expect(getUnifiedTokenQueryRef(createUnifiedToken({ bridgeToken }))).toBe(
      '0x2222222222222222222222222222222222222222',
    );
  });

  test('falls back to unified address when no source token metadata exists', () => {
    expect(getUnifiedTokenQueryRef(createUnifiedToken())).toBe(
      '0x2222222222222222222222222222222222222222',
    );
  });

  test('matches swap token address before bridge collateral address', () => {
    const token = createUnifiedToken({
      chainName: 'ethereum',
      swapToken: createSwapToken({ address: '0x1111111111111111111111111111111111111111' }),
      bridgeToken: createMockToken({
        chainName: 'ethereum',
        collateralAddressOrDenom: '0x3333333333333333333333333333333333333333',
      }),
    });

    expect(
      findUnifiedTokenByQueryRef([token], 'ethereum', '0x1111111111111111111111111111111111111111'),
    ).toBe(token);
  });

  test('matches bridge collateral address before bridge addressOrDenom', () => {
    const token = createUnifiedToken({
      chainName: 'ethereum',
      bridgeToken: createMockToken({
        chainName: 'ethereum',
        addressOrDenom: '0x2222222222222222222222222222222222222222',
        collateralAddressOrDenom: '0x3333333333333333333333333333333333333333',
      }),
    });

    expect(
      findUnifiedTokenByQueryRef([token], 'ethereum', '0x3333333333333333333333333333333333333333'),
    ).toBe(token);
  });

  test('matches bridge addressOrDenom', () => {
    const token = createUnifiedToken({
      chainName: 'ethereum',
      bridgeToken: createMockToken({
        chainName: 'ethereum',
        addressOrDenom: '0x2222222222222222222222222222222222222222',
        collateralAddressOrDenom: undefined,
      }),
    });

    expect(
      findUnifiedTokenByQueryRef([token], 'ethereum', '0x2222222222222222222222222222222222222222'),
    ).toBe(token);
  });

  test('does not match query params by symbol', () => {
    const token = createUnifiedToken({ chainName: 'ethereum', symbol: 'USDC' });

    expect(findUnifiedTokenByQueryRef([token], 'ethereum', 'USDC')).toBeUndefined();
  });

  test('uses native token for zeroish query refs', () => {
    const nativeToken = createUnifiedToken({
      chainName: 'ethereum',
      isNative: true,
      swapToken: createSwapToken({
        address: '0x0000000000000000000000000000000000000000',
        isNative: true,
      }),
    });
    const hypNativeToken = createUnifiedToken({
      key: 'ethereum-hyp-native',
      chainName: 'ethereum',
      isNative: true,
      bridgeToken: createMockToken({
        chainName: 'ethereum',
        standard: TokenStandard.EvmHypNative,
        collateralAddressOrDenom: undefined,
      }),
    });

    expect(
      findUnifiedTokenByQueryRef(
        [hypNativeToken, nativeToken],
        'ethereum',
        '0x0000000000000000000000000000000000000000',
      ),
    ).toBe(nativeToken);
  });
});
