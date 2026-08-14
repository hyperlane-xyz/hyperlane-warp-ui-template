import { SealevelTokenAdapter, TokenStandard } from '@hyperlane-xyz/sdk';
import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  deriveSealevelHypSyntheticMint,
  fetchSealevelChainBalances,
  readSealevelTokenBalance,
} from './sealevel';
import type { BalanceToken } from './types';
import { getBalanceTokenKey } from './types';

const WARP_ROUTER = '4iQfUG5RC58qAdwiLUUv3xmUnADviy4TQ1pqJVrSR2fE';
const SYNTHETIC_MINT = 'BWsnyEa1XtsNRdgPaDoA1WVUonF7BBGZTd2zc72NQsWT';
const OWNER = '11111111111111111111111111111111';
const RPC_URL = 'https://solana-rpc.test';

const token: BalanceToken = {
  chainId: 1399811149,
  chainName: 'solanamainnet',
  address: WARP_ROUTER,
  symbol: 'BLEND',
  decimals: 9,
  isNative: false,
  standard: TokenStandard.SealevelHypSynthetic,
};

const multiProvider = {
  tryGetChainMetadata: () => ({
    rpcUrls: [{ http: RPC_URL }],
  }),
} as never;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deriveSealevelHypSyntheticMint', () => {
  test('derives the BLEND Token-2022 mint from its Warp router', () => {
    expect(deriveSealevelHypSyntheticMint(WARP_ROUTER).toBase58()).toBe(SYNTHETIC_MINT);
  });
});

describe('Sealevel synthetic balances', () => {
  test('uses the SDK synthetic adapter for single-token reads', async () => {
    const getBalance = vi
      .spyOn(SealevelTokenAdapter.prototype, 'getBalance')
      .mockResolvedValue(123n);

    const balance = await readSealevelTokenBalance(multiProvider, {
      chainName: token.chainName,
      tokenAddress: token.address,
      isNative: token.isNative,
      owner: OWNER,
      standard: token.standard,
    });

    expect(balance).toBe(123n);
    expect(getBalance).toHaveBeenCalledWith(OWNER);
    expect((getBalance.mock.instances[0] as SealevelTokenAdapter).addresses.token).toBe(
      SYNTHETIC_MINT,
    );
  });

  test('reads the Token-2022 ATA derived from the synthetic mint in batched reads', async () => {
    const getMultipleAccountsInfo = vi
      .spyOn(Connection.prototype, 'getMultipleAccountsInfo')
      .mockResolvedValue([
        {
          data: Buffer.alloc(AccountLayout.span),
          executable: false,
          lamports: 0,
          owner: TOKEN_2022_PROGRAM_ID,
          rentEpoch: 0,
        },
      ]);
    vi.spyOn(AccountLayout, 'decode').mockReturnValue({ amount: 456n } as never);

    const balances = await fetchSealevelChainBalances(RPC_URL, [token], OWNER);

    const expectedAta = getAssociatedTokenAddressSync(
      new PublicKey(SYNTHETIC_MINT),
      new PublicKey(OWNER),
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    expect(getMultipleAccountsInfo).toHaveBeenCalledWith([expectedAta]);
    expect(balances[getBalanceTokenKey(token)]).toBe(456n);
  });
});
