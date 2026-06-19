import { Token, TokenStandard } from '@hyperlane-xyz/sdk';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';
import { fetchStarknetChainBalances, resolveStarknetBalanceStandard } from './starknet';

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

describe('resolveStarknetBalanceStandard', () => {
  test('uses the normal token adapter because engine token addresses are wallet-held assets', () => {
    expect(resolveStarknetBalanceStandard()).toBe(TokenStandard.StarknetNative);
  });

  test('uses the HypNative adapter for native warp routes', () => {
    expect(resolveStarknetBalanceStandard({ standard: TokenStandard.StarknetHypNative })).toBe(
      TokenStandard.StarknetHypNative,
    );
  });
});

describe('fetchStarknetChainBalances', () => {
  test('reads balances through the SDK token adapter fallback', async () => {
    const token = mockToken({ standard: TokenStandard.StarknetHypCollateral });
    const getBalance = vi.spyOn(Token.prototype, 'getBalance').mockResolvedValue({
      amount: 12_345n,
    } as Awaited<ReturnType<Token['getBalance']>>);

    const balances = await fetchStarknetChainBalances({} as never, [token], USER_ADDRESS);

    expect(balances[getTokenKey(token)]).toBe(12_345n);
    expect((getBalance.mock.instances[0] as Token).standard).toBe(TokenStandard.StarknetNative);
    expect(getBalance).toHaveBeenCalledWith({}, USER_ADDRESS);
  });
});
