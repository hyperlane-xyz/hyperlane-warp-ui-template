import { Token, TokenStandard } from '@hyperlane-xyz/sdk';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchStarknetChainBalances, resolveStarknetBalanceStandard } from './starknet';
import type { BalanceToken } from './types';
import { getBalanceTokenKey } from './types';

const TOKEN_ADDRESS = '0x074238dfa02063792077820584c925b679a013cbab38e5ca61af5627d1eda736';
const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const USER_ADDRESS = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function mockToken(overrides: Partial<BalanceToken> = {}): BalanceToken {
  return {
    chainId: 358974494,
    address: TOKEN_ADDRESS,
    symbol: 'Bonk',
    decimals: 5,
    isNative: false,
    chainName: 'starknet',
    name: 'Bonk',
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

    expect(balances[getBalanceTokenKey(token)]).toBe(12_345n);
    expect((getBalance.mock.instances[0] as Token).standard).toBe(TokenStandard.StarknetNative);
    expect(getBalance).toHaveBeenCalledWith({}, USER_ADDRESS);
  });

  test('resolves native balance reads through chain metadata instead of zero address', async () => {
    const token = mockToken({
      address: '0x0000000000000000000000000000000000000000',
      isNative: true,
      symbol: 'STRK',
      decimals: 18,
    });
    const getBalance = vi.spyOn(Token.prototype, 'getBalance').mockResolvedValue({
      amount: 10n,
    } as Awaited<ReturnType<Token['getBalance']>>);

    const balances = await fetchStarknetChainBalances(
      {
        tryGetChainMetadata: () => ({ nativeToken: { denom: STRK_ADDRESS } }),
      } as never,
      [token],
      USER_ADDRESS,
    );

    expect(balances[getBalanceTokenKey(token)]).toBe(10n);
    expect((getBalance.mock.instances[0] as Token).addressOrDenom).toBe(STRK_ADDRESS);
  });
});
