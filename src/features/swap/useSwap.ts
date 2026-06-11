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

import { logger } from '../../utils/logger';
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
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (args: ExecuteArgs) => {
      setError(null);
      setIsPending(true);

      const { transactionId, route, srcChainId } = args;

      if (!route.raw.tx) throw new Error('Route has no tx');

      const srcChainName = multiProvider.tryGetChainName(srcChainId);
      const protocol = multiProvider.tryGetProtocol(srcChainId);
      if (!srcChainName || !protocol) {
        throw new Error(`No SDK metadata for chain ${srcChainId} — boot may not have completed.`);
      }

      const fns = transactionFns[protocol as keyof typeof transactionFns];
      if (!fns) throw new Error(`No transaction handler for protocol ${protocol}`);

      const txType = protocol === ProtocolType.Tron ? ProviderType.Tron : ProviderType.EthersV5;

      try {
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
        if (args.spender && args.approvalAmount != null && !args.isNative) {
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
          await postCommitment(route.raw.callCommitment);
        }

        updateSwapTransactionStatus(transactionId, SwapStatus.SigningSwap);
        const { hash, confirm } = await fns.sendTransaction({
          tx: {
            type: txType,
            transaction: {
              to: route.raw.tx.to,
              data: route.raw.tx.data,
              value: route.raw.tx.value,
            },
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
        if (expectsBridge && !parsed.messages.length) {
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

        updateSwapTransactionStatus(transactionId, SwapStatus.Bridging, {
          msgIds: labelMessages(parsed.messages, route),
          originBlockNumber: parsed.originBlockNumber,
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
    [transactionFns, multiProvider, updateSwapTransactionStatus],
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

  return messages.map((msg) => {
    if (bridgeRouters.has(msg.sender.toLowerCase())) {
      return { msgId: msg.msgId, label: 'warp' as const };
    }

    const ccsLabel = getCcsMessageLabel(msg.body);
    if (ccsLabel) return { msgId: msg.msgId, label: ccsLabel };

    logger.warn('Unexpected swap message shape; labeling as warp', {
      msgId: msg.msgId,
      sender: msg.sender,
    });
    return { msgId: msg.msgId, label: 'warp' as const };
  });
}

function getCcsMessageLabel(body: string): LabeledMsgId['label'] | null {
  // CCS message bodies use the first byte as the message type.
  if (body.startsWith('0x01')) return 'commit';
  if (body.startsWith('0x02')) return 'reveal';
  return null;
}
