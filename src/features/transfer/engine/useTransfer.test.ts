import { ProviderType } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { RouteTx } from '../../api/types';
import {
  getRawRouteProviderType,
  prepareApprovalTransaction,
  prepareRouteTransaction,
} from './routeTransactions';

const { populateApproveTxMock } = vi.hoisted(() => ({ populateApproveTxMock: vi.fn() }));

vi.mock('@hyperlane-xyz/sdk', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    EvmTokenAdapter: class {
      populateApproveTx = populateApproveTxMock;
    },
  };
});

describe('prepareRouteTransaction', () => {
  beforeEach(() => {
    populateApproveTxMock.mockReset().mockResolvedValue({ to: '0xtoken', data: '0xapprove' });
  });

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

    const walletTx = (await prepareRouteTransaction(routeTx, {
      protocol: ProtocolType.Sealevel,
      sender: sender.toBase58(),
      rpcUrl: 'http://localhost:8899',
    })) as { transaction: VersionedTransaction };

    expect(walletTx.transaction).toBeInstanceOf(VersionedTransaction);
    expect(typeof walletTx.transaction.serialize).toBe('function');
  });

  test('preserves typed SDK transactions for non-EVM VMs', async () => {
    const routeTx: RouteTx = {
      protocol: ProtocolType.Cosmos,
      type: ProviderType.CosmJs,
      category: 'transfer',
      transaction: { typeUrl: '/test.Msg' },
    };

    await expect(prepareRouteTransaction(routeTx, { protocol: ProtocolType.Cosmos })).resolves.toBe(
      routeTx,
    );
  });

  test('rejects raw transactions for VMs that require typed SDK payloads', () => {
    expect(() => getRawRouteProviderType(ProtocolType.Cosmos)).toThrow(
      'Raw route transactions are unsupported for cosmos',
    );
  });

  test.each([
    [ProtocolType.Ethereum, ProviderType.EthersV5],
    [ProtocolType.Tron, ProviderType.Tron],
  ])('prepares %s approvals with its protocol provider type', async (protocol, type) => {
    await expect(
      prepareApprovalTransaction({
        multiProvider: {} as never,
        chainName: 'source',
        protocol,
        token: '0xtoken',
        spender: '0xspender',
        amount: 7n,
      }),
    ).resolves.toEqual({
      type,
      transaction: { to: '0xtoken', data: '0xapprove', value: '0' },
      category: 'transfer',
    });
    expect(populateApproveTxMock).toHaveBeenCalledWith({
      weiAmountOrId: '7',
      recipient: '0xspender',
    });
  });
});
