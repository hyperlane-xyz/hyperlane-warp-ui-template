import { ProviderType, type TypedTransaction } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import { isChainRouteTx } from '../../api/routeTx';
import type { RouteTx } from '../../api/types';

interface PrepareRouteTransactionOptions {
  protocol: ProtocolType;
  sender?: string;
  rpcUrl?: string;
}

// Converts the engine payload into the exact typed transaction used by both
// fee estimation and wallet execution.
export async function prepareRouteTransaction(
  tx: RouteTx,
  options: PrepareRouteTransactionOptions,
): Promise<TypedTransaction> {
  if (!isChainRouteTx(tx)) return deserializeSdkTransaction(tx) as TypedTransaction;

  const type = getRawRouteProviderType(options.protocol);
  if (type === ProviderType.SolanaWeb3) {
    return {
      type,
      transaction: await buildSolanaTransaction(tx, options),
      category: 'transfer',
    } as TypedTransaction;
  }

  return {
    type,
    transaction: { to: tx.to, data: tx.data, value: tx.value },
    category: 'transfer',
  } as TypedTransaction;
}

// Raw {to,data,value} payloads are emitted only by EVM, Tron, and Solana
// encoders. Other VMs arrive as typed SDK transactions and bypass this map.
export function getRawRouteProviderType(protocol: ProtocolType): ProviderType {
  if (protocol === ProtocolType.Ethereum) return ProviderType.EthersV5;
  if (protocol === ProtocolType.Tron) return ProviderType.Tron;
  if (protocol === ProtocolType.Sealevel) return ProviderType.SolanaWeb3;
  throw new Error(`Raw route transactions are unsupported for ${protocol}`);
}

function deserializeSdkTransaction(tx: Extract<RouteTx, { protocol: string }>): unknown {
  if (tx.type !== ProviderType.SolanaWeb3) return tx;
  return { ...tx, transaction: deserializeSolanaTransaction(tx.transaction) };
}

function deserializeSolanaTransaction(raw: unknown): Transaction | VersionedTransaction {
  const payload = raw as { encoding?: unknown; data?: unknown };
  if (payload.encoding !== 'base64' || typeof payload.data !== 'string') {
    throw new Error('Invalid Solana transaction payload from quote');
  }
  const bytes = base64ToBytes(payload.data);
  try {
    return Transaction.from(bytes);
  } catch {
    return VersionedTransaction.deserialize(bytes);
  }
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(value);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

async function buildSolanaTransaction(
  tx: Extract<RouteTx, { to: string }>,
  options: Pick<PrepareRouteTransactionOptions, 'sender' | 'rpcUrl'>,
): Promise<VersionedTransaction> {
  if (!options.sender) throw new Error('Missing Solana sender for route transaction');
  if (!options.rpcUrl) throw new Error('Missing Solana RPC URL for route transaction');

  const connection = new Connection(options.rpcUrl, 'confirmed');
  const instruction = new TransactionInstruction({
    programId: new PublicKey(tx.to),
    data: Buffer.from(tx.data, 'base64'),
    keys: (tx.accounts ?? []).map((account) => ({
      pubkey: new PublicKey(account.pubkey),
      isSigner: account.isSigner,
      isWritable: account.isWritable,
    })),
  });
  const preInstructions = (tx.preInstructions ?? []).map(
    (preInstruction) =>
      new TransactionInstruction({
        programId: new PublicKey(preInstruction.programId),
        data: Buffer.from(preInstruction.data, 'base64'),
        keys: preInstruction.accounts.map((account) => ({
          pubkey: new PublicKey(account.pubkey),
          isSigner: account.isSigner,
          isWritable: account.isWritable,
        })),
      }),
  );
  const [{ blockhash }, altAccounts] = await Promise.all([
    connection.getLatestBlockhash(),
    loadAddressLookupTables(connection, tx.altAddresses ?? []),
  ]);
  const message = new TransactionMessage({
    payerKey: new PublicKey(options.sender),
    recentBlockhash: blockhash,
    instructions: [...preInstructions, instruction],
  }).compileToV0Message(altAccounts);

  return new VersionedTransaction(message);
}

async function loadAddressLookupTables(
  connection: Connection,
  altAddresses: string[],
): Promise<AddressLookupTableAccount[]> {
  if (!altAddresses.length) return [];
  const results = await Promise.all(
    altAddresses.map((address) => connection.getAddressLookupTable(new PublicKey(address))),
  );
  return results.map((result, index) => {
    if (!result.value) throw new Error(`Address Lookup Table not found: ${altAddresses[index]}`);
    return result.value;
  });
}
