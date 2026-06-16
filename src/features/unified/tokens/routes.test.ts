import { describe, expect, test } from 'vitest';

import { createMockToken, createTokenConnectionMock } from '../../../utils/test';
import type { UiToken } from '../../swap/tokens/types';
import { groupTokensByCollateral } from '../../tokens/utils';
import { getUnifiedRouteMode, UnifiedRouteMode } from './routes';
import type { UnifiedToken } from './types';

function createSwapToken(address: string): UiToken {
  return {
    chainId: 1,
    address,
    symbol: 'FAKE',
    decimals: 6,
    isNative: false,
    isBridgeToken: false,
    isPoolToken: true,
    canBridge: false,
    canSwap: true,
    bridgeSymbols: [],
    warpRouteIds: [],
    chainName: 'ethereum',
    name: 'Fake Token',
    addressOrDenom: address,
  };
}

function createUnifiedToken(args: Partial<UnifiedToken> = {}): UnifiedToken {
  return {
    key: 'token',
    chainName: 'ethereum',
    chainId: 1,
    addressOrDenom: '0x0000000000000000000000000000000000000001',
    symbol: 'FAKE',
    name: 'Fake Token',
    decimals: 6,
    isNative: false,
    capabilities: { bridge: false, swap: false },
    ...args,
  };
}

describe('getUnifiedRouteMode', () => {
  test('prefers bridge when both bridge and swap routes exist', () => {
    const originBridgeToken = createMockToken({
      chainName: 'ethereum',
      connections: [createTokenConnectionMock(undefined, { chainName: 'arbitrum' })],
    });
    const destinationBridgeToken = createMockToken({ chainName: 'arbitrum' });
    const collateralGroups = groupTokensByCollateral([originBridgeToken, destinationBridgeToken]);

    const mode = getUnifiedRouteMode({
      originToken: createUnifiedToken({
        bridgeToken: originBridgeToken,
        swapToken: createSwapToken('0x0000000000000000000000000000000000000001'),
      }),
      destinationToken: createUnifiedToken({
        bridgeToken: destinationBridgeToken,
        swapToken: createSwapToken('0x0000000000000000000000000000000000000002'),
      }),
      collateralGroups,
      engineEnabled: true,
    });

    expect(mode).toBe(UnifiedRouteMode.Bridge);
  });

  test('uses swap when bridge is unavailable and engine is configured', () => {
    const mode = getUnifiedRouteMode({
      originToken: createUnifiedToken({
        swapToken: createSwapToken('0x0000000000000000000000000000000000000001'),
      }),
      destinationToken: createUnifiedToken({
        swapToken: createSwapToken('0x0000000000000000000000000000000000000002'),
      }),
      collateralGroups: new Map(),
      engineEnabled: true,
    });

    expect(mode).toBe(UnifiedRouteMode.Swap);
  });

  test('does not use swap when engine is not configured', () => {
    const mode = getUnifiedRouteMode({
      originToken: createUnifiedToken({
        swapToken: createSwapToken('0x0000000000000000000000000000000000000001'),
      }),
      destinationToken: createUnifiedToken({
        swapToken: createSwapToken('0x0000000000000000000000000000000000000002'),
      }),
      collateralGroups: new Map(),
      engineEnabled: false,
    });

    expect(mode).toBeNull();
  });
});
