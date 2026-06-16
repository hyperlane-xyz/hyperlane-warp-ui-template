import { describe, expect, test } from 'vitest';

import { createMockToken } from '../../../utils/test';
import type { UiToken } from '../../swap/tokens/types';
import { getUnifiedTokenQueryRef } from './queryParams';
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

  test('keeps bridge-only URLs symbol based', () => {
    const bridgeToken = createMockToken({ symbol: 'USDC' });
    expect(getUnifiedTokenQueryRef(createUnifiedToken({ bridgeToken }))).toBe('USDC');
  });

  test('falls back to unified address when no source token metadata exists', () => {
    expect(getUnifiedTokenQueryRef(createUnifiedToken())).toBe(
      '0x2222222222222222222222222222222222222222',
    );
  });
});
