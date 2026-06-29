import {
  type ChainMap,
  type CoreAddresses,
  EvmTokenAdapter,
  HyperlaneCore,
  MultiProtocolCore,
  ProviderType,
  type TypedTransactionReceipt,
} from '@hyperlane-xyz/sdk';
import { isZeroishAddress, ProtocolType } from '@hyperlane-xyz/utils';
import { useTransactionFns } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { useCallback, useState } from 'react';
import type { Address } from 'viem';

import { logger } from '../../../utils/logger';
import type { RouteTx } from '../../api/types';
import { useMultiProvider } from '../../chains/hooks';
import { useStore } from '../../store';
import { submitToRelayApi } from '../relayApi';
import { postCommitment } from './ccs';
import { labelTransferMessages, type ParsedTransferMessage } from './messages';
import { TransferStatus } from './types';
import type { AugmentedRoute } from './types';

interface ExecuteArgs {
  transactionId: string;
  route: AugmentedRoute;
  srcChainId: number;
  dstChainId: number;
  srcToken: string;
  dstToken: string;
  sender: string;
  recipient: string;
  /** Token returned by route.approval. Defaults to srcToken for older quotes. */
  approvalToken?: string;
  /** Spender returned by route.approval. Skips approval flow if absent or `isNative`. */
  spender?: Address;
  /** Amount returned by route.approval. */
  approvalAmount?: bigint;
  /** True when no approval is required. */
  isNative?: boolean;
}

// Single execution path covering EVM + Tron via the SDK's protocol-aware
// transaction adapters.
export function useTransfer() {
  const multiProvider = useMultiProvider();
  const transactionFns = useTransactionFns(multiProvider);
  const chainAddresses = useStore((s) => s.chainAddresses);
  const updateTransferTransactionStatus = useStore((s) => s.updateTransferTransactionStatus);
  const setTransferRoute = useStore((s) => s.setTransferRoute);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (args: ExecuteArgs) => {
      const { transactionId, route, srcChainId } = args;
      setError(null);
      setIsPending(true);

      try {
        const routeTxs = route.raw.txs?.length ? route.raw.txs : route.raw.tx ? [route.raw.tx] : [];
        if (!routeTxs.length) throw new Error('Route has no tx');

        // Store route for status polling and recovery (non-persisted, session only).
        setTransferRoute(transactionId, route.raw);

        const srcChainName = multiProvider.tryGetChainName(srcChainId);
        const protocol = multiProvider.tryGetProtocol(srcChainId);
        if (!srcChainName || !protocol) {
          throw new Error(`No SDK metadata for chain ${srcChainId} — boot may not have completed.`);
        }

        const fns = transactionFns[protocol as keyof typeof transactionFns];
        if (!fns) throw new Error(`No transaction handler for protocol ${protocol}`);

        const txType =
          protocol === ProtocolType.Sealevel
            ? ProviderType.SolanaWeb3
            : protocol === ProtocolType.Tron
              ? ProviderType.Tron
              : ProviderType.EthersV5;

        if (fns.switchNetwork) {
          try {
            await fns.switchNetwork(srcChainName);
          } catch (err) {
            logger.warn(`switchNetwork to ${srcChainName} failed; continuing`, err as Error);
          }
        }

        // Approve / revoke before the transfer tx: bump non-zero existing
        // allowance to zero first (USDT case), then approve the new amount.
        if (
          protocol !== ProtocolType.Sealevel &&
          args.spender &&
          args.approvalAmount != null &&
          !args.isNative
        ) {
          const spender = args.spender;
          if (isZeroishAddress(spender)) {
            throw new Error(`Cannot approve: spender is zero address on ${srcChainName}`);
          }
          const adapter = new EvmTokenAdapter(srcChainName, multiProvider, {
            token: args.approvalToken ?? args.srcToken,
          });
          const [needsApprove, needsRevoke] = await Promise.all([
            adapter.isApproveRequired(args.sender, spender, args.approvalAmount.toString()),
            adapter.isRevokeApprovalRequired(args.sender, spender),
          ]);
          const doApprove = async (amount: bigint) => {
            updateTransferTransactionStatus(transactionId, TransferStatus.SigningApprove);
            const populated = await adapter.populateApproveTx({
              weiAmountOrId: amount.toString(),
              recipient: spender,
            });
            const { hash, confirm } = await fns.sendTransaction({
              tx: {
                type: txType,
                transaction: { to: populated.to!, data: populated.data!, value: '0' },
                category: 'transfer',
              } as Parameters<typeof fns.sendTransaction>[0]['tx'],
              chainName: srcChainName,
            });
            updateTransferTransactionStatus(transactionId, TransferStatus.ConfirmingApprove);
            const receipt = await confirm();
            if (isReverted(receipt)) {
              logger.error('Approve tx reverted', new Error(`tx=${hash}`));
              throw new Error('Approve transaction reverted on chain');
            }
          };
          if (needsApprove && needsRevoke) await doApprove(0n);
          if (needsApprove) await doApprove(args.approvalAmount);
        }

        // Order is critical: post to CCS BEFORE broadcasting.
        if (route.raw.callCommitment) {
          updateTransferTransactionStatus(transactionId, TransferStatus.CreatingTxs);
          try {
            await postCommitment(route.raw.callCommitment);
          } catch (ccsErr) {
            logger.error('CCS post failed — aborting transfer', ccsErr);
            updateTransferTransactionStatus(transactionId, TransferStatus.Failed);
            const err = new Error(
              'Could not register transfer with the coordination service. Your funds are safe — please try again.',
            );
            setError(err);
            throw err;
          }
        }

        let hash: string | undefined;
        let receipt: TypedTransactionReceipt | undefined;
        for (const routeTx of routeTxs) {
          updateTransferTransactionStatus(transactionId, TransferStatus.SigningTransfer);
          const sent = await fns.sendTransaction({
            tx: (await toWalletTx(routeTx, txType, {
              sender: args.sender,
              rpcUrl: multiProvider.tryGetChainMetadata(srcChainName)?.rpcUrls?.[0]?.http,
            })) as Parameters<typeof fns.sendTransaction>[0]['tx'],
            chainName: srcChainName,
          });
          hash = sent.hash;

          updateTransferTransactionStatus(transactionId, TransferStatus.ConfirmingOrigin, {
            originTxHash: hash,
          });

          receipt = await sent.confirm();
          if (isReverted(receipt)) {
            logger.error('Origin tx reverted', new Error(`tx=${hash}`));
            updateTransferTransactionStatus(transactionId, TransferStatus.Failed, {
              originTxHash: hash,
            });
            const err = new Error('Origin transaction reverted on chain');
            setError(err);
            throw err;
          }
        }

        if (!hash || !receipt) throw new Error('Route transaction did not return a receipt');
        const parsed = await parseReceipt(multiProvider, chainAddresses, srcChainName, receipt);
        const hasCrossChainStep = route.raw.steps.some((s) => s.type === 'bridge');
        const canReadDispatchLogs = isEvmReceipt(receipt);
        if (hasCrossChainStep && canReadDispatchLogs && !parsed.messages.length) {
          logger.error('Origin tx confirmed but no Dispatch log emitted', new Error(`tx=${hash}`));
          updateTransferTransactionStatus(transactionId, TransferStatus.Failed, {
            originTxHash: hash,
            originBlockNumber: parsed.originBlockNumber,
          });
          const err = new Error(
            'Origin transaction did not emit a Hyperlane Dispatch — it likely reverted internally',
          );
          setError(err);
          throw err;
        }
        // Same-chain transfer: finalize on origin confirm.
        if (!hasCrossChainStep) {
          updateTransferTransactionStatus(transactionId, TransferStatus.ConfirmedDestination, {
            originTxHash: hash,
            destinationTxHash: hash,
            originBlockNumber: parsed.originBlockNumber,
          });
          return hash;
        }
        submitToRelayApi(srcChainName, hash, protocol as ProtocolType, receipt);

        updateTransferTransactionStatus(transactionId, TransferStatus.Bridging, {
          msgIds: labelTransferMessages(parsed.messages, route.raw),
          originBlockNumber: parsed.originBlockNumber,
          originTxTimestamp: Math.floor(Date.now() / 1000),
        });

        return hash;
      } catch (err) {
        logger.error('Transfer broadcast failed', err);
        updateTransferTransactionStatus(transactionId, TransferStatus.Failed);
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [
      transactionFns,
      multiProvider,
      chainAddresses,
      updateTransferTransactionStatus,
      setTransferRoute,
    ],
  );

  return { execute, isPending, error };
}

function isReverted(receipt: TypedTransactionReceipt): boolean {
  // Tron receipts wrap an ethers v5 receipt (same `status` shape) — treat
  // them identically to EVM for the revert check.
  if (
    receipt.type !== ProviderType.Viem &&
    receipt.type !== ProviderType.EthersV5 &&
    receipt.type !== ProviderType.Tron
  ) {
    return false;
  }
  const status = (receipt.receipt as { status?: string | number }).status;
  if (typeof status === 'string') return status === 'reverted';
  if (typeof status === 'number') return status === 0;
  return false;
}

function isEvmReceipt(receipt: TypedTransactionReceipt): boolean {
  return (
    receipt.type === ProviderType.Viem ||
    receipt.type === ProviderType.EthersV5 ||
    receipt.type === ProviderType.Tron
  );
}

function isChainRouteTx(tx: RouteTx): tx is Extract<RouteTx, { to: string }> {
  return 'to' in tx;
}

export async function toWalletTx(
  tx: RouteTx,
  txType: ProviderType,
  opts: { sender?: string; rpcUrl?: string } = {},
): Promise<unknown> {
  if (!isChainRouteTx(tx)) return toSdkWalletTx(tx);
  if (txType === ProviderType.SolanaWeb3) {
    return {
      type: txType,
      transaction: await buildSolanaTransaction(tx, opts),
      category: 'transfer',
    };
  }
  return {
    type: txType,
    transaction: {
      to: tx.to,
      data: tx.data,
      value: tx.value,
    },
    category: 'transfer',
  };
}

function toSdkWalletTx(tx: Extract<RouteTx, { protocol: string }>): unknown {
  if (tx.type !== ProviderType.SolanaWeb3) return tx;
  const transaction = deserializeSolanaTransaction(tx.transaction);
  return {
    ...tx,
    transaction,
  };
}

function deserializeSolanaTransaction(raw: unknown): Transaction | VersionedTransaction {
  const payload = raw as { encoding?: unknown; data?: unknown };
  if (payload.encoding !== 'base64' || typeof payload.data !== 'string') {
    throw new Error('Invalid Solana transaction payload from quote');
  }
  const bytes = base64ToBytes(payload.data);
  try {
    const tx = Transaction.from(bytes);
    return tx;
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
  opts: { sender?: string; rpcUrl?: string },
): Promise<VersionedTransaction> {
  if (!opts.sender) throw new Error('Missing Solana sender for route transaction');
  if (!opts.rpcUrl) throw new Error('Missing Solana RPC URL for route transaction');
  if (tx.additionalSigners?.length) {
    throw new Error('Solana route included unsupported additionalSigners');
  }

  const connection = new Connection(opts.rpcUrl, 'confirmed');
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
    payerKey: new PublicKey(opts.sender),
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

async function parseReceipt(
  multiProvider: ReturnType<typeof useMultiProvider>,
  chainAddresses: ChainMap<Partial<CoreAddresses>>,
  origin: string,
  receipt: TypedTransactionReceipt,
): Promise<{
  messages: ParsedTransferMessage[];
  originBlockNumber: number | undefined;
}> {
  // Tron is EVM-like — emits Hyperlane Dispatch logs in the same shape.
  if (
    receipt.type === ProviderType.Viem ||
    receipt.type === ProviderType.EthersV5 ||
    receipt.type === ProviderType.Tron
  ) {
    const rawReceipt = receipt.receipt as Parameters<
      typeof HyperlaneCore.getDispatchedMessages
    >[0] & {
      blockNumber?: bigint | number;
    };
    const dispatched = HyperlaneCore.getDispatchedMessages(rawReceipt);
    const messages = dispatched.map((m) => ({
      msgId: m.id,
      sender: m.parsed.sender,
      body: m.parsed.body,
    }));
    return {
      messages,
      originBlockNumber: maybeNumber(rawReceipt.blockNumber),
    };
  }

  try {
    const core = new MultiProtocolCore(
      multiProvider,
      buildCoreAddresses(multiProvider, chainAddresses),
    );
    const messages = await core.extractMessageIds(origin, receipt);
    return {
      messages: messages.map((m) => ({ msgId: m.messageId })),
      originBlockNumber: getReceiptBlockNumber(receipt),
    };
  } catch (err) {
    logger.warn('Could not extract Hyperlane message IDs from origin receipt', err as Error);
    return {
      messages: [],
      originBlockNumber: getReceiptBlockNumber(receipt),
    };
  }
}

function buildCoreAddresses(
  multiProvider: ReturnType<typeof useMultiProvider>,
  chainAddresses: ChainMap<Partial<CoreAddresses>>,
): ChainMap<CoreAddresses> {
  return multiProvider.getKnownChainNames().reduce<ChainMap<CoreAddresses>>((acc, chainName) => {
    acc[chainName] = {
      validatorAnnounce: chainAddresses[chainName]?.validatorAnnounce ?? '',
      proxyAdmin: chainAddresses[chainName]?.proxyAdmin ?? '',
      mailbox: chainAddresses[chainName]?.mailbox ?? '',
      quotedCalls: chainAddresses[chainName]?.quotedCalls ?? '',
    };
    return acc;
  }, {});
}

function getReceiptBlockNumber(receipt: TypedTransactionReceipt): number | undefined {
  const raw = receipt.receipt as {
    blockNumber?: bigint | number;
    block_number?: bigint | number;
    height?: bigint | number;
  };
  return maybeNumber(raw.blockNumber ?? raw.block_number ?? raw.height);
}

function maybeNumber(value: bigint | number | undefined): number | undefined {
  if (value == null) return undefined;
  return Number(value);
}
