import {
  EvmTokenAdapter,
  HyperlaneCore,
  ProviderType,
  type TypedTransactionReceipt,
} from '@hyperlane-xyz/sdk';
import { isZeroishAddress, ProtocolType } from '@hyperlane-xyz/utils';
import { useTransactionFns } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useCallback, useState } from 'react';
import type { Address } from 'viem';

import { logger } from '../../../utils/logger';
import type { RouteTx } from '../../api/types';
import { useMultiProvider } from '../../chains/hooks';
import { useStore } from '../../store';
import { submitToRelayApi } from '../relayApi';
import { postCommitment } from './ccs';
import { TransferStatus } from './types';
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

        const txType = protocol === ProtocolType.Tron ? ProviderType.Tron : ProviderType.EthersV5;

        if (fns.switchNetwork) {
          try {
            await fns.switchNetwork(srcChainName);
          } catch (err) {
            logger.warn(`switchNetwork to ${srcChainName} failed; continuing`, err as Error);
          }
        }

        // Approve / revoke before the transfer tx: bump non-zero existing
        // allowance to zero first (USDT case), then approve the new amount.
        if (args.spender && args.approvalAmount != null && !args.isNative) {
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
            tx: toWalletTx(routeTx, txType) as Parameters<typeof fns.sendTransaction>[0]['tx'],
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
        const parsed = parseReceipt(receipt);
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
          msgIds: labelMessages(parsed.messages, route),
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
    [transactionFns, multiProvider, updateTransferTransactionStatus, setTransferRoute],
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

function isEvmRouteTx(tx: RouteTx): tx is Extract<RouteTx, { to: string }> {
  return 'to' in tx;
}

function toWalletTx(tx: RouteTx, txType: ProviderType): unknown {
  if (!isEvmRouteTx(tx)) return tx;
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

interface ParsedMessage {
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

function labelMessages(messages: ParsedMessage[], route: AugmentedRoute): LabeledMsgId[] {
  const bridgeRouters = new Set(
    route.raw.steps
      .filter(
        (s): s is Extract<(typeof route.raw.steps)[number], { type: 'bridge' }> =>
          s.type === 'bridge',
      )
      .map((s) => s.router.toLowerCase()),
  );

  const nonWarp = messages.filter((m) => !bridgeRouters.has(m.sender.toLowerCase()));
  // callRemoteCommitReveal dispatches COMMIT first, REVEAL last. CCTP aggregation
  // routes prepend an extra internal message, so identify REVEAL as the last
  // non-warp message rather than counting from the front.
  const revealMsg = nonWarp.at(-1);

  return messages.map((msg) => {
    if (bridgeRouters.has(msg.sender.toLowerCase())) {
      return { msgId: msg.msgId, label: 'warp' as const };
    }

    const ccsLabel = getCcsMessageLabel(msg.body);
    if (ccsLabel) return { msgId: msg.msgId, label: ccsLabel };
    if (msg === revealMsg) return { msgId: msg.msgId, label: 'reveal' as const };

    logger.warn('Unexpected transfer message shape; labeling as commit', {
      msgId: msg.msgId,
      sender: msg.sender,
    });
    return { msgId: msg.msgId, label: 'commit' as const };
  });
}

function getCcsMessageLabel(body: string): LabeledMsgId['label'] | null {
  // CCS message bodies use the first byte as the message type.
  if (body.startsWith('0x01')) return 'commit';
  if (body.startsWith('0x02')) return 'reveal';
  return null;
}
