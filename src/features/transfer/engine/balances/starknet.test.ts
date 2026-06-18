import { Token, TokenStandard } from '@hyperlane-xyz/sdk';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';
import { fetchStarknetChainBalances, resolveStarknetStandard } from './starknet';

const TOKEN_ADDRESS = '0x074238dfa02063792077820584c925b679a013cbab38e5ca61af5627d1eda736';
const USER_ADDRESS = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function mockToken(overrides: Partial<UiToken> = {}): UiToken {
  return {
    chainId: 358974494,
    address: TOKEN_ADDRESS,
    symbol: 'Bonk',
    decimals: 5,
    isNative: false,
    isBridgeToken: true,
    isPoolToken: false,
    canBridge: true,
    canSwap: false,
    bridgeSymbols: ['Bonk'],
    warpRouteIds: ['Bonk/starknet'],
    chainName: 'starknet',
    name: 'Bonk',
    addressOrDenom: TOKEN_ADDRESS,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveStarknetStandard', () => {
  test('uses engine-provided Starknet standard when present', () => {
    expect(
      resolveStarknetStandard({
        standard: TokenStandard.StarknetHypCollateral,
        isNative: false,
      }),
    ).toBe(TokenStandard.StarknetHypCollateral);
  });

  test('defaults bridge tokens without standard to StarknetHypSynthetic', () => {
    expect(resolveStarknetStandard({ isNative: false })).toBe(TokenStandard.StarknetHypSynthetic);
  });
});

describe('fetchStarknetChainBalances', () => {
  test('reads balances through the SDK token adapter fallback', async () => {
    const token = mockToken();
    const getBalance = vi.spyOn(Token.prototype, 'getBalance').mockResolvedValue({
      amount: 12_345n,
    } as Awaited<ReturnType<Token['getBalance']>>);

    const balances = await fetchStarknetChainBalances({} as never, [token], USER_ADDRESS);

    expect(balances[getTokenKey(token)]).toBe(12_345n);
    expect(getBalance).toHaveBeenCalledWith({}, USER_ADDRESS);
  });
});
