import {
  EvmTokenAdapter,
  HyperlaneCore,
  ProviderType,
  SealevelCoreAdapter,
  type TypedTransactionReceipt,
} from '@hyperlane-xyz/sdk';
import { isZeroishAddress, ProtocolType } from '@hyperlane-xyz/utils';
import { useTransactionFns } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import {
  AddressLookupTableAccount,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { useCallback, useState } from 'react';
import type { Address } from 'viem';

import { logger } from '../../utils/logger';
import type { RouteTx } from '../api/types';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import { submitToRelayApi } from '../transfer/relayApi';
import { postCommitment } from './ccs';
import { SwapStatus } from './types';
import type { AugmentedRoute, LabeledMsgId } from './types';

interface ExecuteArgs {
  transactionId: string;
  route: AugmentedRoute;
  srcChainId: number;
  dstChainId: number;
  srcToken: string;
  dstToken: string;
  sender: string;
  recipient: string;
  /** UR address to approve. Skips approval flow if absent or `isNative`. */
  spender?: Address;
  /** Amount to approve. Same as `amountAtomic` derived from the quote. */
  approvalAmount?: bigint;
  /** Native source skips approval entirely. */
  isNative?: boolean;
}

// Single execution path covering EVM + Tron via the SDK's protocol-aware
// transaction adapters.
export function useSwap() {
  const multiProvider = useMultiProvider();
  const transactionFns = useTransactionFns(multiProvider);
  const updateSwapTransactionStatus = useStore((s) => s.updateSwapTransactionStatus);
  const chainAddresses = useStore((s) => s.chainAddresses);
  const setSwapRoute = useStore((s) => s.setSwapRoute);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (args: ExecuteArgs) => {
      setError(null);
      setIsPending(true);

      const { transactionId, route, srcChainId } = args;

      try {
        if (!route.raw.tx) throw new Error('Route has no tx');

        // Store route for status polling and recovery (non-persisted, session only).
        setSwapRoute(transactionId, route.raw);

        const srcChainName = multiProvider.tryGetChainName(srcChainId);
        const protocol = multiProvider.tryGetProtocol(srcChainId);
        if (!srcChainName || !protocol) {
          throw new Error(`No SDK metadata for chain ${srcChainId} — boot may not have completed.`);
        }

        const fns = transactionFns[protocol as keyof typeof transactionFns];
        if (!fns) throw new Error(`No transaction handler for protocol ${protocol}`);

        const isSealevel = protocol === ProtocolType.Sealevel;
        const txType = isSealevel
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

        // Approve / revoke before the swap tx. Mirrors WarpCore's pattern:
        // bump non-zero existing allowance to zero first (USDT case), then
        // approve the new amount.
        if (!isSealevel && args.spender && args.approvalAmount != null && !args.isNative) {
          const spender = args.spender;
          if (isZeroishAddress(spender)) {
            throw new Error(`Cannot approve: spender is zero address on ${srcChainName}`);
          }
          const adapter = new EvmTokenAdapter(srcChainName, multiProvider, {
            token: args.srcToken,
          });
          const [needsApprove, needsRevoke] = await Promise.all([
            adapter.isApproveRequired(args.sender, spender, args.approvalAmount.toString()),
            adapter.isRevokeApprovalRequired(args.sender, spender),
          ]);
          const doApprove = async (amount: bigint) => {
            updateSwapTransactionStatus(transactionId, SwapStatus.SigningApprove);
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
            updateSwapTransactionStatus(transactionId, SwapStatus.ConfirmingApprove);
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
          updateSwapTransactionStatus(transactionId, SwapStatus.CreatingTxs);
          try {
            await postCommitment(route.raw.callCommitment);
          } catch (ccsErr) {
            logger.error('CCS post failed — aborting swap', ccsErr);
            updateSwapTransactionStatus(transactionId, SwapStatus.Failed);
            const err = new Error(
              'Could not register swap with the coordination service. Your funds are safe — please try again.',
            );
            setError(err);
            throw err;
          }
        }

        updateSwapTransactionStatus(transactionId, SwapStatus.SigningSwap);
        const txPayload = isSealevel
          ? await buildSolanaTransaction(
              route.raw.tx,
              args.sender,
              multiProvider.getChainMetadata(srcChainName).rpcUrls[0]?.http ??
                (() => {
                  throw new Error(`No RPC URL for chain ${srcChainName}`);
                })(),
            )
          : {
              to: route.raw.tx.to,
              data: route.raw.tx.data,
              value: route.raw.tx.value,
            };
        const { hash, confirm } = await fns.sendTransaction({
          tx: {
            type: txType,
            transaction: txPayload,
            category: 'transfer',
          } as Parameters<typeof fns.sendTransaction>[0]['tx'],
          chainName: srcChainName,
        });

        updateSwapTransactionStatus(transactionId, SwapStatus.ConfirmingOrigin, {
          originTxHash: hash,
        });

        const receipt = await confirm();
        if (isReverted(receipt)) {
          logger.error('Origin tx reverted', new Error(`tx=${hash}`));
          updateSwapTransactionStatus(transactionId, SwapStatus.Failed, { originTxHash: hash });
          const err = new Error('Origin transaction reverted on chain');
          setError(err);
          throw err;
        }
        const parsed = parseReceipt(receipt);
        const expectsBridge = route.raw.steps.some((s) => s.type === 'bridge');
        if (!isSealevel && expectsBridge && !parsed.messages.length) {
          logger.error('Origin tx confirmed but no Dispatch log emitted', new Error(`tx=${hash}`));
          updateSwapTransactionStatus(transactionId, SwapStatus.Failed, {
            originTxHash: hash,
            originBlockNumber: parsed.originBlockNumber,
          });
          const err = new Error(
            'Origin transaction did not emit a Hyperlane Dispatch — it likely reverted internally',
          );
          setError(err);
          throw err;
        }
        // Same-chain swap (no bridge step): finalize on origin confirm.
        if (!expectsBridge) {
          updateSwapTransactionStatus(transactionId, SwapStatus.ConfirmedDestination, {
            originTxHash: hash,
            destinationTxHash: hash,
            originBlockNumber: parsed.originBlockNumber,
          });
          return hash;
        }
        submitToRelayApi(srcChainName, hash, protocol as ProtocolType, receipt);

        let msgIds: LabeledMsgId[];
        if (isSealevel) {
          const mailbox = chainAddresses[srcChainName]?.mailbox;
          ensureSolanaMessageExtractionReady(mailbox, srcChainName);
          const adapter = new SealevelCoreAdapter(srcChainName, multiProvider, { mailbox });
          const messages = await adapter.extractMessageIds(receipt);
          msgIds = labelSolanaMessages(
            messages.map(({ messageId }) => messageId as `0x${string}`),
            route,
          );
          ensureSolanaMessagesExtracted(msgIds, expectsBridge);
        } else {
          msgIds = labelMessages(parsed.messages, route);
        }

        updateSwapTransactionStatus(transactionId, SwapStatus.Bridging, {
          msgIds,
          originBlockNumber: parsed.originBlockNumber,
          originTxTimestamp: Math.floor(Date.now() / 1000),
        });

        return hash;
      } catch (err) {
        logger.error('Swap broadcast failed', err);
        updateSwapTransactionStatus(transactionId, SwapStatus.Failed);
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [transactionFns, multiProvider, updateSwapTransactionStatus, chainAddresses, setSwapRoute],
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

export interface ParsedMessage {
  msgId: `0x${string}`;
  sender: `0x${string}`;
  body: string;
}

function parseReceipt(receipt: TypedTransactionReceipt): {
  messages: ParsedMessage[];
  originBlockNumber: number | undefined;
} {
  // Tron is EVM-like — emits Hyperlane Dispatch logs in the same shape.
  if (
    receipt.type !== ProviderType.Viem &&
    receipt.type !== ProviderType.EthersV5 &&
    receipt.type !== ProviderType.Tron
  ) {
    return { messages: [], originBlockNumber: undefined };
  }
  const rawReceipt = receipt.receipt as Parameters<
    typeof HyperlaneCore.getDispatchedMessages
  >[0] & {
    blockNumber?: bigint | number;
  };
  const dispatched = HyperlaneCore.getDispatchedMessages(rawReceipt);
  const messages = dispatched.map((m) => ({
    msgId: m.id as `0x${string}`,
    sender: m.parsed.sender as `0x${string}`,
    body: m.parsed.body,
  }));
  const blockNumber = rawReceipt.blockNumber;
  return {
    messages,
    originBlockNumber: blockNumber != null ? Number(blockNumber) : undefined,
  };
}

export function labelMessages(messages: ParsedMessage[], route: AugmentedRoute): LabeledMsgId[] {
  // Dispatch sender is bytes32 (padded EVM address). Strip leading zeros to get the 20-byte address.
  const addrOf = (sender: string) => sender.replace(/^0x/i, '').toLowerCase().slice(-40);

  const bridgeRouters = new Set(
    route.raw.steps
      .filter(
        (s): s is Extract<(typeof route.raw.steps)[number], { type: 'bridge' }> =>
          s.type === 'bridge',
      )
      .map((s) => s.router.replace(/^0x/i, '').toLowerCase()),
  );
  const urAddr = route.raw.tx?.to?.replace(/^0x/i, '').toLowerCase();

  const nonWarp = messages.filter((m) => !bridgeRouters.has(addrOf(m.sender)));
  // callRemoteCommitReveal dispatches COMMIT first, REVEAL last. CCTP aggregation
  // routes prepend an extra internal message, so identify REVEAL as the last
  // non-warp message rather than counting from the front.
  const revealMsg = nonWarp.at(-1);

  return messages.map((msg) => {
    const senderAddr = addrOf(msg.sender);

    if (bridgeRouters.has(senderAddr)) {
      return { msgId: msg.msgId, label: 'warp' as const };
    }

    const ccsLabel = getCcsMessageLabel(msg.body);
    if (ccsLabel) return { msgId: msg.msgId, label: ccsLabel };

    if (route.raw.callCommitment && urAddr && senderAddr === urAddr && msg !== revealMsg) {
      return { msgId: msg.msgId, label: 'commit' as const };
    }
    if (msg === revealMsg) return { msgId: msg.msgId, label: 'reveal' as const };

    logger.warn('Unexpected swap message shape; labeling as commit', {
      msgId: msg.msgId,
      sender: msg.sender,
    });
    return { msgId: msg.msgId, label: 'commit' as const };
  });
}

export function labelSolanaMessages(
  messageIds: `0x${string}`[],
  route: AugmentedRoute,
): LabeledMsgId[] {
  const hasBridge = route.raw.steps.some((s) => s.type === 'bridge');
  if (!route.raw.callCommitment) {
    return messageIds.map((msgId) => ({ msgId, label: 'warp' as const }));
  }

  // Engine Solana encoder dispatches bridge first, then commit/reveal for
  // destination EVM swaps. The SDK preserves log order from the receipt.
  const firstCcsIndex = hasBridge ? 1 : 0;
  const revealIndex = messageIds.length - 1;

  return messageIds.map((msgId, index) => {
    if (index < firstCcsIndex) return { msgId, label: 'warp' as const };
    if (index === revealIndex && index >= firstCcsIndex) {
      return { msgId, label: 'reveal' as const };
    }
    return { msgId, label: 'commit' as const };
  });
}

export function ensureSolanaMessageExtractionReady(
  mailbox: string | undefined,
  srcChainName: string,
): asserts mailbox is string {
  if (!mailbox) {
    throw new Error(`No mailbox address for Solana source chain ${srcChainName}`);
  }
}

export function ensureSolanaMessagesExtracted(
  msgIds: LabeledMsgId[],
  expectsBridge: boolean,
): void {
  if (!expectsBridge || msgIds.length) return;
  throw new Error(
    'Origin Solana tx confirmed but no message IDs extracted — it likely reverted internally',
  );
}

export function getCcsMessageLabel(body: string): LabeledMsgId['label'] | null {
  // CCS message bodies use the first byte as the message type.
  if (body.startsWith('0x01')) return 'commit';
  if (body.startsWith('0x02')) return 'reveal';
  return null;
}

async function buildSolanaTransaction(
  tx: RouteTx,
  sender: string,
  rpcUrl: string,
): Promise<VersionedTransaction> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const programId = new PublicKey(tx.to);
  const data = Buffer.from(tx.data, 'base64');
  const keys = (tx.accounts ?? []).map((account) => ({
    pubkey: new PublicKey(account.pubkey),
    isSigner: account.isSigner,
    isWritable: account.isWritable,
  }));
  const instruction = new TransactionInstruction({ programId, data, keys });

  const preInstructions = (tx.preInstructions ?? []).map(
    (preInstruction) =>
      new TransactionInstruction({
        programId: new PublicKey(preInstruction.programId),
        keys: preInstruction.accounts.map((account) => ({
          pubkey: new PublicKey(account.pubkey),
          isSigner: account.isSigner,
          isWritable: account.isWritable,
        })),
        data: Buffer.from(preInstruction.data, 'base64'),
      }),
  );

  const [{ blockhash }, altAccounts] = await Promise.all([
    connection.getLatestBlockhash(),
    loadAltAccounts(connection, tx.altAddresses ?? []),
  ]);

  const message = new TransactionMessage({
    payerKey: new PublicKey(sender),
    recentBlockhash: blockhash,
    instructions: [...preInstructions, instruction],
  }).compileToV0Message(altAccounts);

  const transaction = new VersionedTransaction(message);
  if (tx.additionalSigners?.length) {
    transaction.sign(
      tx.additionalSigners.map((signer) =>
        Keypair.fromSecretKey(new Uint8Array(Buffer.from(signer, 'base64'))),
      ),
    );
  }

  return transaction;
}

async function loadAltAccounts(
  connection: Connection,
  altAddresses: string[],
): Promise<AddressLookupTableAccount[]> {
  if (!altAddresses.length) return [];

  const results = await Promise.all(
    altAddresses.map((address) => connection.getAddressLookupTable(new PublicKey(address))),
  );
  const accounts: AddressLookupTableAccount[] = [];
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    if (!result?.value) {
      throw new Error(`Address Lookup Table not found: ${altAddresses[index]}`);
    }
    accounts.push(result.value);
  }
  return accounts;
}
