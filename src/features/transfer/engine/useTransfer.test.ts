import { ProviderType } from '@hyperlane-xyz/sdk';
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { RouteTx } from '../../api/types';
import { toWalletTx } from './useTransfer';

describe('toWalletTx', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('deserializes Solana engine payloads with existing partial signatures', async () => {
    const feePayer = Keypair.generate();
    const extraSigner = Keypair.generate();
    const tx = new Transaction({
      feePayer: feePayer.publicKey,
      recentBlockhash: '11111111111111111111111111111111',
    }).add(
      SystemProgram.transfer({
        fromPubkey: extraSigner.publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1,
      }),
    );
    tx.partialSign(extraSigner);

    const routeTx: RouteTx = {
      protocol: 'sealevel',
      type: ProviderType.SolanaWeb3,
      category: 'transfer',
      transaction: {
        encoding: 'base64',
        data: Buffer.from(
          tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
        ).toString('base64'),
      },
    };

    const walletTx = (await toWalletTx(routeTx, ProviderType.SolanaWeb3)) as {
      transaction: Transaction;
    };

    expect(walletTx.transaction).toBeInstanceOf(Transaction);
    expect(typeof walletTx.transaction.serialize).toBe('function');
    expect(
      walletTx.transaction.signatures.find((sig) => sig.publicKey.equals(extraSigner.publicKey))
        ?.signature,
    ).not.toBeNull();
  });

  test('builds Solana route instruction payloads without additional signers', async () => {
    vi.spyOn(Connection.prototype, 'getLatestBlockhash').mockResolvedValue({
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 1,
    });
    const sender = Keypair.generate().publicKey;
    const routeTx: RouteTx = {
      to: SystemProgram.programId.toBase58(),
      data: '',
      value: '0',
      accounts: [{ pubkey: sender.toBase58(), isSigner: true, isWritable: true }],
      preInstructions: [
        {
          programId: SystemProgram.programId.toBase58(),
          accounts: [],
          data: '',
        },
      ],
    };

    const walletTx = (await toWalletTx(routeTx, ProviderType.SolanaWeb3, {
      sender: sender.toBase58(),
      rpcUrl: 'http://localhost:8899',
    })) as { transaction: VersionedTransaction };

    expect(walletTx.transaction).toBeInstanceOf(VersionedTransaction);
    expect(typeof walletTx.transaction.serialize).toBe('function');
  });
});
