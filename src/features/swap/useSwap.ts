import { HyperlaneCore, ProviderType, type TypedTransactionReceipt } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useTransactionFns } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useCallback, useState } from 'react';

import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import { submitToRelayApi } from '../transfer/relayApi';
import { postCommitment } from './ccs';
import { SwapStatus } from './types';
import type { AugmentedRoute, LabeledMsgId } from './types';

interface ExecuteArgs {
  swapIndex: number;
  route: AugmentedRoute;
  srcChainId: number;
  dstChainId: number;
  srcToken: string;
  dstToken: string;
  sender: string;
  recipient: string;
}

// Single execution path covering EVM + Tron via the SDK's protocol-aware
// transaction adapters.
export function useSwap() {
  const multiProvider = useMultiProvider();
  const transactionFns = useTransactionFns(multiProvider);
  const updateSwapStatus = useStore((s) => s.updateSwapStatus);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (args: ExecuteArgs) => {
      setError(null);
      setIsPending(true);

      const { swapIndex, route, srcChainId } = args;

      if (!route.raw.tx) throw new Error('Route has no tx');

      const srcChainName = multiProvider.tryGetChainName(srcChainId);
      const protocol = multiProvider.tryGetProtocol(srcChainId);
      if (!srcChainName || !protocol) {
        throw new Error(`No SDK metadata for chain ${srcChainId} — boot may not have completed.`);
      }

      const fns = transactionFns[protocol as keyof typeof transactionFns];
      if (!fns) throw new Error(`No transaction handler for protocol ${protocol}`);

      try {
        if (fns.switchNetwork) {
          try {
            await fns.switchNetwork(srcChainName);
          } catch (err) {
            logger.warn(`switchNetwork to ${srcChainName} failed; continuing`, err as Error);
          }
        }

        // Order is critical: post to CCS BEFORE broadcasting.
        if (route.raw.callCommitment) {
          updateSwapStatus(swapIndex, SwapStatus.CreatingTxs);
          await postCommitment(route.raw.callCommitment);
        }

        updateSwapStatus(swapIndex, SwapStatus.SigningSwap);
        const txType = protocol === ProtocolType.Tron ? ProviderType.Tron : ProviderType.EthersV5;
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

        updateSwapStatus(swapIndex, SwapStatus.ConfirmingOrigin, { originTxHash: hash });

        const receipt = await confirm();
        if (isReverted(receipt)) {
          logger.error('Origin tx reverted', new Error(`tx=${hash}`));
          updateSwapStatus(swapIndex, SwapStatus.Failed, { originTxHash: hash });
          const err = new Error('Origin transaction reverted on chain');
          setError(err);
          throw err;
        }
        const parsed = parseReceipt(receipt);
        const expectsBridge = route.raw.steps.some((s) => s.type === 'bridge');
        if (expectsBridge && !parsed.messages.length) {
          logger.error('Origin tx confirmed but no Dispatch log emitted', new Error(`tx=${hash}`));
          updateSwapStatus(swapIndex, SwapStatus.Failed, {
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
          updateSwapStatus(swapIndex, SwapStatus.ConfirmedDestination, {
            originTxHash: hash,
            destinationTxHash: hash,
            originBlockNumber: parsed.originBlockNumber,
          });
          return hash;
        }
        submitToRelayApi(srcChainName, hash, protocol as ProtocolType, receipt);

        updateSwapStatus(swapIndex, SwapStatus.Bridging, {
          msgIds: labelMessages(parsed.messages, route),
          originBlockNumber: parsed.originBlockNumber,
        });

        return hash;
      } catch (err) {
        logger.error('Swap broadcast failed', err);
        updateSwapStatus(swapIndex, SwapStatus.Failed);
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [transactionFns, multiProvider, updateSwapStatus],
  );

  return { execute, isPending, error };
}

function isReverted(receipt: TypedTransactionReceipt): boolean {
  if (receipt.type !== ProviderType.Viem && receipt.type !== ProviderType.EthersV5) {
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
}

function parseReceipt(receipt: TypedTransactionReceipt): {
  messages: ParsedMessage[];
  originBlockNumber: number | undefined;
} {
  if (receipt.type !== ProviderType.Viem && receipt.type !== ProviderType.EthersV5) {
    return { messages: [], originBlockNumber: undefined };
  }
  const rawReceipt = receipt.receipt as Parameters<typeof HyperlaneCore.getDispatchedMessages>[0] & {
    blockNumber?: bigint | number;
  };
  const dispatched = HyperlaneCore.getDispatchedMessages(rawReceipt);
  const messages = dispatched.map((m) => ({
    msgId: m.id as `0x${string}`,
    sender: m.parsed.sender as `0x${string}`,
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
      .filter((s): s is Extract<(typeof route.raw.steps)[number], { type: 'bridge' }> => s.type === 'bridge')
      .map((s) => s.router.toLowerCase()),
  );

  let nonWarpCount = 0;
  return messages.map((msg) => {
    if (bridgeRouters.has(msg.sender.toLowerCase())) {
      return { msgId: msg.msgId, label: 'warp' as const };
    }
    // Commit precedes reveal in the CCS protocol; >2 non-warp messages is unexpected.
    if (nonWarpCount >= 2) {
      logger.warn('Unexpected non-warp message count in swap receipt', { nonWarpCount, msgId: msg.msgId });
    }
    const label = nonWarpCount === 0 ? ('commit' as const) : ('reveal' as const);
    nonWarpCount++;
    return { msgId: msg.msgId, label };
  });
}
