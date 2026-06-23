import { ProviderType } from '@hyperlane-xyz/sdk';
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import { describe, expect, test } from 'vitest';

import type { RouteTx } from '../../api/types';
import { toWalletTx } from './useTransfer';

describe('toWalletTx', () => {
  test('deserializes Solana engine payloads with existing partial signatures', () => {
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

    const walletTx = toWalletTx(routeTx, ProviderType.SolanaWeb3) as {
      transaction: Transaction;
    };

    expect(walletTx.transaction).toBeInstanceOf(Transaction);
    expect(typeof walletTx.transaction.serialize).toBe('function');
    expect(
      walletTx.transaction.signatures.find((sig) => sig.publicKey.equals(extraSigner.publicKey))
        ?.signature,
    ).not.toBeNull();
  });
});
