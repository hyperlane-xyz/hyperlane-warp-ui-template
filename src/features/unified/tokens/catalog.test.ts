import { TestChainName, TokenStandard, type MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import { addressZero, createMockToken, mockCollateralAddress } from '../../../utils/test';
import type { UiToken } from '../../swap/tokens/types';
import { buildUnifiedTokenCatalog } from './catalog';

const multiProvider = {
  tryGetChainMetadata: (chainName: string) => {
    if (chainName === TestChainName.test1) return { chainId: 1 };
    if (chainName === TestChainName.test2) return { chainId: 2 };
    if (chainName === 'tronmainnet') return { chainId: 728126428, protocol: ProtocolType.Tron };
    return undefined;
  },
} as MultiProtocolProvider;

function createSwapToken(args: Partial<UiToken> = {}): UiToken {
  return {
    chainId: 1,
    address: mockCollateralAddress,
    symbol: 'FAKE',
    decimals: 6,
    isNative: false,
    isBridgeToken: false,
    isPoolToken: true,
    canBridge: false,
    canSwap: true,
    bridgeSymbols: [],
    warpRouteIds: [],
    chainName: TestChainName.test1,
    name: 'Fake Token',
    addressOrDenom: mockCollateralAddress,
    ...args,
  };
}

describe('buildUnifiedTokenCatalog', () => {
  test('merges engine ERC20 token with bridge token by collateralAddressOrDenom', () => {
    const bridgeToken = createMockToken({
      addressOrDenom: addressZero,
      collateralAddressOrDenom: mockCollateralAddress,
    });
    const swapToken = createSwapToken();

    const result = buildUnifiedTokenCatalog({
      bridgeTokens: [bridgeToken],
      swapTokens: [swapToken],
      multiProvider,
    });

    expect(result).toHaveLength(1);
    expect(result[0].bridgeToken).toBe(bridgeToken);
    expect(result[0].swapToken).toBe(swapToken);
    expect(result[0].capabilities).toEqual({ bridge: true, swap: true });
  });

  test('preserves same-collateral bridge route members in one unified row', () => {
    const firstBridgeToken = createMockToken({
      addressOrDenom: '0x1111111111111111111111111111111111111111',
      collateralAddressOrDenom: mockCollateralAddress,
    });
    const secondBridgeToken = createMockToken({
      addressOrDenom: '0x2222222222222222222222222222222222222222',
      collateralAddressOrDenom: mockCollateralAddress,
    });

    const result = buildUnifiedTokenCatalog({
      bridgeTokens: [firstBridgeToken, secondBridgeToken],
      swapTokens: [],
      multiProvider,
    });

    expect(result).toHaveLength(1);
    expect(result[0].bridgeToken).toBe(firstBridgeToken);
    expect(result[0].bridgeRouteTokens).toEqual([firstBridgeToken, secondBridgeToken]);
  });

  test('keeps native bridge token separate from wrapped engine token', () => {
    const bridgeToken = createMockToken({
      standard: TokenStandard.EvmHypNative,
      symbol: 'ETH',
      collateralAddressOrDenom: undefined,
    });
    const wrappedSwapToken = createSwapToken({
      address: '0x4200000000000000000000000000000000000006',
      addressOrDenom: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      decimals: 18,
    });

    const result = buildUnifiedTokenCatalog({
      bridgeTokens: [bridgeToken],
      swapTokens: [wrappedSwapToken],
      multiProvider,
    });

    expect(result).toHaveLength(2);
    expect(result.some((token) => token.bridgeToken === bridgeToken && !token.swapToken)).toBe(
      true,
    );
    expect(result.some((token) => token.swapToken === wrappedSwapToken && !token.bridgeToken)).toBe(
      true,
    );
  });

  test('merges native engine token with native bridge token', () => {
    const bridgeToken = createMockToken({
      standard: TokenStandard.EvmHypNative,
      symbol: 'ETH',
      collateralAddressOrDenom: undefined,
    });
    const nativeSwapToken = createSwapToken({
      address: addressZero,
      addressOrDenom: addressZero,
      symbol: 'ETH',
      decimals: 18,
      isNative: true,
      wrappedAddress: '0x4200000000000000000000000000000000000006',
    });

    const result = buildUnifiedTokenCatalog({
      bridgeTokens: [bridgeToken],
      swapTokens: [nativeSwapToken],
      multiProvider,
    });

    expect(result).toHaveLength(1);
    expect(result[0].bridgeToken).toBe(bridgeToken);
    expect(result[0].swapToken).toBe(nativeSwapToken);
  });

  test('uses chain protocol when creating swap-only token identity', () => {
    const tronAddress = '0xabcdef0000000000000000000000000000000000';
    const swapToken = createSwapToken({
      chainName: 'tronmainnet',
      chainId: 728126428,
      address: tronAddress,
      addressOrDenom: tronAddress,
    });

    const result = buildUnifiedTokenCatalog({
      bridgeTokens: [],
      swapTokens: [swapToken],
      multiProvider,
    });

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe(`unified-728126428-${tronAddress}`);
  });
});
