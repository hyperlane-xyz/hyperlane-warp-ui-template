import { TokenStandard } from '@hyperlane-xyz/sdk';
import { describe, expect, test } from 'vitest';

import { createMockToken } from '../../../utils/test';
import type { UiToken } from '../../swap/tokens/types';
import {
  findUnifiedTokenByQueryRef,
  getUnifiedTokenLookupIdsFromParams,
  getUnifiedTokenQueryParams,
  getUnifiedTokenQueryRef,
} from './queryParams';
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
  test('builds engine lookup ids from address query params', () => {
    const params = new URLSearchParams(
      'origin=bsc&originToken=0xfb6115445Bff7b52FeB98650C87f44907E58f802&destination=base&destinationToken=0x63706e401c06ac8513145b7687A14804d17f814b',
    );

    expect(getUnifiedTokenLookupIdsFromParams(params)).toEqual([
      'bsc-0xfb6115445Bff7b52FeB98650C87f44907E58f802',
      'base-0x63706e401c06ac8513145b7687A14804d17f814b',
    ]);
  });

  test('skips incomplete query token refs when building lookup ids', () => {
    const params = new URLSearchParams('origin=bsc&destination=base&destinationToken=0x1234');

    expect(getUnifiedTokenLookupIdsFromParams(params)).toEqual(['base-0x1234']);
  });

  test('skips old symbol-style token refs when building engine lookup ids', () => {
    const params = new URLSearchParams(
      'origin=ethereum&originToken=USDC&destination=base&destinationToken=0x2222222222222222222222222222222222222222',
    );

    expect(getUnifiedTokenLookupIdsFromParams(params)).toEqual([
      'base-0x2222222222222222222222222222222222222222',
    ]);
  });

  test('keeps non-EVM token refs when building engine lookup ids', () => {
    const params = new URLSearchParams(
      'origin=solanamainnet&originToken=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB&destination=noble&destinationToken=uusdc',
    );

    expect(getUnifiedTokenLookupIdsFromParams(params)).toEqual([
      'solanamainnet-Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      'noble-uusdc',
    ]);
  });

  test('uses swap token address when available', () => {
    expect(getUnifiedTokenQueryRef(createUnifiedToken({ swapToken: createSwapToken() }))).toBe(
      '0x1111111111111111111111111111111111111111',
    );
  });

  test('uses bridge collateral address before swap address', () => {
    const bridgeToken = createMockToken({
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x3333333333333333333333333333333333333333',
    });
    expect(
      getUnifiedTokenQueryRef(createUnifiedToken({ bridgeToken, swapToken: createSwapToken() })),
    ).toBe('0x3333333333333333333333333333333333333333');
  });

  test('builds destination URL params with bridge-first token refs', () => {
    const bridgeToken = createMockToken({
      chainName: 'base',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x3333333333333333333333333333333333333333',
    });
    const token = createUnifiedToken({
      chainName: 'base',
      bridgeToken,
      swapToken: createSwapToken({
        chainName: 'base',
        address: '0x1111111111111111111111111111111111111111',
      }),
    });

    expect(getUnifiedTokenQueryParams(token, 'destination')).toEqual({
      destination: 'base',
      destinationToken: '0x3333333333333333333333333333333333333333',
    });
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

  test('still matches swap token address when that is the URL ref', () => {
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

  test('matches bridge token before swap token for the same URL ref', () => {
    const bridgeToken = createUnifiedToken({
      key: 'bridge-usdc',
      chainName: 'ethereum',
      bridgeToken: createMockToken({
        chainName: 'ethereum',
        collateralAddressOrDenom: '0x1111111111111111111111111111111111111111',
      }),
    });
    const swapToken = createUnifiedToken({
      key: 'swap-usdc',
      chainName: 'ethereum',
      swapToken: createSwapToken({ address: '0x1111111111111111111111111111111111111111' }),
    });

    expect(
      findUnifiedTokenByQueryRef(
        [swapToken, bridgeToken],
        'ethereum',
        '0x1111111111111111111111111111111111111111',
      ),
    ).toBe(bridgeToken);
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

  test('matches any same-collateral bridge route address', () => {
    const primaryBridgeToken = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: '0x3333333333333333333333333333333333333333',
    });
    const secondaryBridgeToken = createMockToken({
      chainName: 'ethereum',
      addressOrDenom: '0x4444444444444444444444444444444444444444',
      collateralAddressOrDenom: '0x3333333333333333333333333333333333333333',
    });
    const token = createUnifiedToken({
      chainName: 'ethereum',
      bridgeToken: primaryBridgeToken,
      bridgeRouteTokens: [primaryBridgeToken, secondaryBridgeToken],
    });

    expect(
      findUnifiedTokenByQueryRef([token], 'ethereum', '0x4444444444444444444444444444444444444444'),
    ).toBe(token);
  });

  test('does not match query params by symbol', () => {
    const token = createUnifiedToken({ chainName: 'ethereum', symbol: 'USDC' });

    expect(findUnifiedTokenByQueryRef([token], 'ethereum', 'USDC')).toBeUndefined();
  });

  test('uses HypNative token before engine native for zeroish query refs', () => {
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
    ).toBe(hypNativeToken);
  });
});
