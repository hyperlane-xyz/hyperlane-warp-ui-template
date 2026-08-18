import { ProviderType } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { RouteTx } from '../../api/types';
import { prepareRouteTransaction } from './routeTransactions';

describe('prepareRouteTransaction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test.each([
    [ProtocolType.Ethereum, ProviderType.EthersV5],
    [ProtocolType.Tron, ProviderType.Tron],
  ])('types raw %s route payloads for SDK estimation and execution', async (protocol, type) => {
    const routeTx: RouteTx = { to: '0x1', data: '0x1234', value: '5' };

    await expect(prepareRouteTransaction(routeTx, { protocol })).resolves.toEqual({
      type,
      transaction: { to: '0x1', data: '0x1234', value: '5' },
      category: 'transfer',
    });
  });

  test('rejects raw route payloads for protocols that require SDK transactions', async () => {
    const routeTx: RouteTx = { to: '0x1', data: '0x1234', value: '5' };

    await expect(
      prepareRouteTransaction(routeTx, { protocol: ProtocolType.Cosmos }),
    ).rejects.toThrow('Raw route transactions are unsupported for cosmos');
  });

  test('restores serialized byte arrays in SDK transactions', async () => {
    const routeTx: RouteTx = {
      protocol: ProtocolType.Cosmos,
      type: ProviderType.CosmJs,
      category: 'transfer',
      transaction: {
        value: { encoding: 'base64', data: Buffer.from([1, 2, 3]).toString('base64') },
      },
    };

    const prepared = (await prepareRouteTransaction(routeTx, {
      protocol: ProtocolType.Cosmos,
    })) as { transaction: { value: Uint8Array } };

    expect(prepared.transaction.value).toEqual(Uint8Array.from([1, 2, 3]));
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

    const walletTx = (await prepareRouteTransaction(routeTx, {
      protocol: ProtocolType.Sealevel,
    })) as {
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
    const connection = new Connection('http://localhost:8899');
    vi.spyOn(connection, 'getLatestBlockhash').mockResolvedValue({
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

    const walletTx = (await prepareRouteTransaction(routeTx, {
      protocol: ProtocolType.Sealevel,
      sender: sender.toBase58(),
      chainName: 'solanamainnet',
      multiProvider: {
        getSolanaWeb3Provider: () => connection,
      } as never,
    })) as { transaction: VersionedTransaction };

    expect(walletTx.transaction).toBeInstanceOf(VersionedTransaction);
    expect(typeof walletTx.transaction.serialize).toBe('function');
  });
});
