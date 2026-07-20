import { IToken, SealevelTokenAdapter, Token, WarpCore } from '@hyperlane-xyz/sdk';
import { describe, expect, test, vi } from 'vitest';

import { chainsRentEstimate } from '../../consts/chains';
import { createMockToken } from '../../utils/test';
import { getSameChainAtaRent } from './useSvmQuotedTransfer';

// Valid base58 pubkey (system program) so `new PublicKey(recipient)` succeeds.
const RECIPIENT = '11111111111111111111111111111111';
const SVM_CHAIN = 'solanamainnet';

// An object whose prototype chain satisfies `instanceof SealevelTokenAdapter`,
// with only the method the helper calls stubbed.
function mockSealevelAdapter(ata = { toBase58: () => 'ata' }) {
  const adapter = Object.create(SealevelTokenAdapter.prototype);
  adapter.deriveAssociatedTokenAccount = vi.fn().mockResolvedValue(ata);
  return adapter;
}

function makeArgs({
  originChain = SVM_CHAIN,
  destination = SVM_CHAIN,
  adapter = mockSealevelAdapter(),
  accountInfo = null as unknown,
}: {
  originChain?: string;
  destination?: string;
  adapter?: unknown;
  accountInfo?: unknown;
}) {
  const getAccountInfo = vi.fn().mockResolvedValue(accountInfo);
  const warpCore = {
    multiProvider: { getSolanaWeb3Provider: () => ({ getAccountInfo }) },
  } as unknown as WarpCore;
  const originToken = createMockToken({ chainName: originChain }) as Token;
  const destinationToken = {
    getAdapter: () => adapter,
  } as unknown as IToken;
  return {
    args: { warpCore, originToken, destinationToken, destination, recipient: RECIPIENT },
    getAccountInfo,
  };
}

describe('getSameChainAtaRent', () => {
  test('returns undefined for a cross-chain transfer', async () => {
    const { args } = makeArgs({ originChain: SVM_CHAIN, destination: 'eclipsemainnet' });
    expect(await getSameChainAtaRent(args)).toBeUndefined();
  });

  test('returns undefined when the chain has no rent estimate', async () => {
    const { args } = makeArgs({ originChain: 'ethereum', destination: 'ethereum' });
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

  test('returns the rent estimate when the recipient ATA is missing', async () => {
    const { args } = makeArgs({ accountInfo: null });
    expect(await getSameChainAtaRent(args)).toEqual(chainsRentEstimate[SVM_CHAIN]);
  });
});
