import type { PublicClient } from 'viem';
import { describe, expect, test, vi } from 'vitest';

import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';
import { fetchEvmChainBalances } from './evm';

const USER_ADDRESS = '0x3Fb137161365f273Ebb8262a26569C117b6CBAfb';
const TOKEN_ADDRESS = '0x545E289B88c6d97b74eC0B96e308cae46Bf5f832';

function mockToken(overrides: Partial<UiToken> = {}): UiToken {
  return {
    chainId: 173,
    address: TOKEN_ADDRESS,
    symbol: 'USDT',
    decimals: 6,
    isNative: false,
    isBridgeToken: true,
    isPoolToken: false,
    canBridge: true,
    canSwap: false,
    bridgeSymbols: ['USDT'],
    warpRouteIds: ['USDT/eni'],
    chainName: 'eni',
    name: 'Tether USD',
    addressOrDenom: TOKEN_ADDRESS,
    ...overrides,
  };
}

describe('fetchEvmChainBalances', () => {
  test('falls back to direct balanceOf when multicall returns a failed result', async () => {
    const token = mockToken();
    const client = {
      multicall: vi.fn().mockResolvedValue([{ status: 'failure', error: new Error('no code') }]),
      readContract: vi.fn().mockResolvedValue(1_000_000n),
    } as unknown as PublicClient;

    const balances = await fetchEvmChainBalances(client, [token], USER_ADDRESS);

    expect(balances[getTokenKey(token)]).toBe(1_000_000n);
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TOKEN_ADDRESS,
        functionName: 'balanceOf',
        args: [USER_ADDRESS],
      }),
    );
  });
});
