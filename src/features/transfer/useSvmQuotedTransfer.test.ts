import { IToken, SealevelTokenAdapter, Token, WarpCore } from '@hyperlane-xyz/sdk';
import { ACCOUNT_SIZE } from '@solana/spl-token';
import { describe, expect, test, vi } from 'vitest';

import { createMockToken } from '../../utils/test';
import { getSameChainAtaRent } from './useSvmQuotedTransfer';

// Valid base58 pubkey (system program) so `new PublicKey(recipient)` succeeds.
const RECIPIENT = '11111111111111111111111111111111';
const SVM_CHAIN = 'solanamainnet';

// An object whose prototype chain satisfies `instanceof SealevelTokenAdapter`,
// with only the members the helper touches stubbed. Defaults to classic SPL.
function mockSealevelAdapter(ata = { toBase58: () => 'ata' }) {
  const adapter = Object.create(SealevelTokenAdapter.prototype);
  adapter.deriveAssociatedTokenAccount = vi.fn().mockResolvedValue(ata);
  adapter.isSpl2022 = vi.fn().mockResolvedValue(false);
  return adapter;
}

function makeArgs({
  originChain = SVM_CHAIN,
  destination = SVM_CHAIN,
  adapter = mockSealevelAdapter(),
  accountInfo = null as unknown,
  rentExemptMinimum = 2039280,
}: {
  originChain?: string;
  destination?: string;
  adapter?: unknown;
  accountInfo?: unknown;
  rentExemptMinimum?: number;
}) {
  const getAccountInfo = vi.fn().mockResolvedValue(accountInfo);
  const getMinimumBalanceForRentExemption = vi.fn().mockResolvedValue(rentExemptMinimum);
  const warpCore = {
    multiProvider: {
      getSolanaWeb3Provider: () => ({ getAccountInfo, getMinimumBalanceForRentExemption }),
    },
  } as unknown as WarpCore;
  const originToken = createMockToken({ chainName: originChain }) as Token;
  const destinationToken = {
    getAdapter: () => adapter,
  } as unknown as IToken;
  return {
    args: { warpCore, originToken, destinationToken, destination, recipient: RECIPIENT },
    getMinimumBalanceForRentExemption,
  };
}

describe('getSameChainAtaRent', () => {
  test('returns undefined for a cross-chain transfer', async () => {
    const { args } = makeArgs({ originChain: SVM_CHAIN, destination: 'eclipsemainnet' });
    expect(await getSameChainAtaRent(args)).toBeUndefined();
  });

  test('returns undefined when the destination adapter is not Sealevel', async () => {
    const { args } = makeArgs({ adapter: {} });
    expect(await getSameChainAtaRent(args)).toBeUndefined();
  });

  test('returns undefined when the recipient ATA already exists', async () => {
    const { args } = makeArgs({ accountInfo: { lamports: 1 } });
    expect(await getSameChainAtaRent(args)).toBeUndefined();
  });

  test('returns the rent-exempt minimum for a classic SPL account when the ATA is missing', async () => {
    const { args, getMinimumBalanceForRentExemption } = makeArgs({
      accountInfo: null,
      rentExemptMinimum: 2039280,
    });

    expect(await getSameChainAtaRent(args)).toEqual(2039280n);
    expect(getMinimumBalanceForRentExemption).toHaveBeenCalledWith(ACCOUNT_SIZE);
  });
});
