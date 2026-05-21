import { ProviderType, type TypedTransactionReceipt } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useTransactionFns } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useCallback, useState } from 'react';
import { keccak256, toBytes } from 'viem';

import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import { postCommitment } from './ccs';
import { SwapStatus } from './types';
import type { AugmentedRoute } from './types';

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

// Hyperlane Mailbox `DispatchId(bytes32 messageId)` topic — msgId = idLog.topics[1].
const DISPATCH_ID_SIG = keccak256(toBytes('DispatchId(bytes32)'));

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
        logger.info('[swap] execute start', {
          swapIndex,
          srcChainId,
          srcChainName,
          protocol,
          to: route.raw.tx.to,
          value: route.raw.tx.value,
          hasCallCommitment: !!route.raw.callCommitment,
        });
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
          logger.info('[swap] posting CCS commitment', {
            commitment: route.raw.callCommitment.commitment,
          });
          await postCommitment(route.raw.callCommitment);
          logger.info('[swap] CCS post ok');
        }

        updateSwapStatus(swapIndex, SwapStatus.SigningSwap);
        const txType = protocol === ProtocolType.Tron ? ProviderType.Tron : ProviderType.EthersV5;
        logger.info('[swap] requesting wallet signature', { txType, chainName: srcChainName });
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
        logger.info('[swap] tx broadcast', { hash });

        updateSwapStatus(swapIndex, SwapStatus.ConfirmingOrigin, { originTxHash: hash });

        logger.info('[swap] awaiting confirm()', { hash });
        const receipt = await confirm();
        logger.info('[swap] confirm() returned', { hash, type: receipt.type });
        if (isReverted(receipt)) {
          logger.error('Origin tx reverted', new Error(`tx=${hash}`));
          updateSwapStatus(swapIndex, SwapStatus.Failed, { originTxHash: hash });
          const err = new Error('Origin transaction reverted on chain');
          setError(err);
          throw err;
        }
        const parsed = parseReceipt(receipt);
        const expectsBridge = route.raw.steps.some((s) => s.type === 'bridge');
        if (expectsBridge && !parsed.msgId) {
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
        updateSwapStatus(swapIndex, SwapStatus.Bridging, {
          msgId: parsed.msgId,
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

function parseReceipt(receipt: TypedTransactionReceipt): {
  msgId: `0x${string}` | undefined;
  originBlockNumber: number | undefined;
} {
  if (receipt.type !== ProviderType.Viem && receipt.type !== ProviderType.EthersV5) {
    return { msgId: undefined, originBlockNumber: undefined };
  }
  const logs =
    (
      receipt.receipt as {
        logs?: Array<{ topics?: readonly string[] }>;
        blockNumber?: bigint | number;
      }
    ).logs ?? [];
  const blockNumber = (receipt.receipt as { blockNumber?: bigint | number }).blockNumber;
  const idLog = logs.find((l) => l.topics?.[0] === DISPATCH_ID_SIG);
  const msgId = (idLog?.topics?.[1] as `0x${string}` | undefined) ?? undefined;
  return {
    msgId,
    originBlockNumber: blockNumber != null ? Number(blockNumber) : undefined,
  };
}
