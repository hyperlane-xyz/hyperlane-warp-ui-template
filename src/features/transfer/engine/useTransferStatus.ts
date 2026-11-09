import { isZeroishAddress } from '@hyperlane-xyz/utils';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { useMultiProvider } from '../../chains/hooks';
import { useStore } from '../../store';
import { FinalTransferStatuses, TransferStatus, type TransferHistoryItem } from './types';

// ERC20 Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DESTINATION_OUTCOME_RETRY_MS = 5_000;
const DESTINATION_OUTCOME_SLOW_RETRY_MS = 60_000;
const MAX_DESTINATION_OUTCOME_RETRIES = 24;

type ReceiptProvider = {
  getTransactionReceipt(
    hash: string,
  ): Promise<{ logs: Array<{ topics: string[]; address: string }> } | null>;
};

export async function detectDestinationOutcome(
  provider: ReceiptProvider,
  destinationTxHash: string,
  recipient: string,
  bridgeToken: string,
  dstToken: string,
  dstIsNative?: boolean,
): Promise<'success' | 'failed_recovered' | 'dest_failed'> {
  const receipt = await provider.getTransactionReceipt(destinationTxHash);
  if (!receipt) throw new Error('Destination transaction receipt not found');

  const recipientLower = recipient.toLowerCase();
  const bridgeTokenLower = bridgeToken.toLowerCase();
  const isNativeOutput = dstIsNative ?? isZeroishAddress(dstToken);
  const dstTokenLower = dstToken.toLowerCase();

  let destinationExecutionSucceeded = false;
  let fallbackDelivered = false;

  for (const log of receipt.logs) {
    if (log.topics[0] !== TRANSFER_TOPIC) continue;
    if (log.topics.length < 3) continue;

    // Indexed addresses are 0x + 24 leading-zero chars + 40 address chars.
    const to = `0x${log.topics[2]!.slice(26)}`.toLowerCase();
    const addr = log.address.toLowerCase();

    if (addr === dstTokenLower && to === recipientLower) destinationExecutionSucceeded = true;
    if (addr === bridgeTokenLower && to === recipientLower) fallbackDelivered = true;
  }

  if (isNativeOutput) {
    // Native payouts do not emit ERC20 Transfer logs, so this receipt
    // heuristic can only prove fallback recovery. Delivery without a
    // bridge-token fallback is treated as success until the route exposes a
    // native-output execution signal.
    return fallbackDelivered ? 'failed_recovered' : 'success';
  }
  if (destinationExecutionSucceeded) return 'success';
  if (fallbackDelivered) return 'failed_recovered';
  return 'dest_failed';
}

// The open receipt owns outcome feedback. Background transfers still notify.
export function notifyTransferOutcome(
  transactionId: string,
  status:
    | TransferStatus.ConfirmedDestination
    | TransferStatus.FailedRecovered
    | TransferStatus.DestFailed,
) {
  if (useStore.getState().selectedTransactionId === transactionId) return;
  if (status === TransferStatus.ConfirmedDestination) {
    toast.success('Transfer complete! Funds have arrived.');
  } else if (status === TransferStatus.FailedRecovered) {
    toast.info('Transfer failed — intermediate token returned to your wallet.');
  } else {
    toast.error('Transfer failed — please contact support, your funds may be in your ICA.');
  }
}

// Fires once when the REVEAL tx hash lands on a transfer. Reads the receipt
// directly from the destination chain RPC to determine outcome without polling
// the engine.
export function useTransferStatus(
  transfer: TransferHistoryItem | undefined,
  transactionId: string | null,
) {
  const route = useStore((s) =>
    transactionId ? s.transferRouteByTransactionId.get(transactionId) : undefined,
  );
  const updateStatus = useStore((s) => s.updateTransferTransactionStatus);
  const multiProvider = useMultiProvider();
  const retryTxHashRef = useRef<string | null>(null);
  const retryAttemptRef = useRef(0);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRetry = () => {
      const delay =
        retryAttemptRef.current >= MAX_DESTINATION_OUTCOME_RETRIES
          ? DESTINATION_OUTCOME_SLOW_RETRY_MS
          : DESTINATION_OUTCOME_RETRY_MS;
      retryAttemptRef.current += 1;
      retryTimer = setTimeout(() => {
        if (!cancelled) setRetryTick((tick) => tick + 1);
      }, delay);
    };

    const { destinationTxHash, destinationOutcome, status, dstChain, recipient } = transfer ?? {};
    if (!destinationTxHash || !transactionId) return undefined;
    if (retryTxHashRef.current !== destinationTxHash) {
      retryTxHashRef.current = destinationTxHash;
      retryAttemptRef.current = 0;
    }
    // Read the latest status: an earlier effect may already have completed this
    // transfer, including React's development effect replay.
    const currentStatus =
      useStore.getState().transactionHistory.find((item) => item.id === transactionId)?.data
        .status ?? status;
    if (currentStatus && FinalTransferStatuses.includes(currentStatus)) return undefined;

    const destinationSwapStep = route?.steps.find(
      (step): step is Extract<NonNullable<typeof route>['steps'][number], { type: 'swap' }> =>
        step.type === 'swap' && step.chain === dstChain,
    );

    // No destination execution step on this ICA route: cross-chain delivery is success.
    if (!destinationOutcome && (!route?.callCommitment || !destinationSwapStep)) {
      updateStatus(transactionId, TransferStatus.ConfirmedDestination);
      notifyTransferOutcome(transactionId, TransferStatus.ConfirmedDestination);
      return undefined;
    }

    const bridgeToken = destinationOutcome?.bridgeToken ?? destinationSwapStep!.tokenIn;
    const dstToken = destinationOutcome?.dstToken ?? destinationSwapStep!.tokenOut;

    let provider: ReceiptProvider | null = null;
    try {
      const chainName = multiProvider.tryGetChainName(dstChain!);
      if (chainName) provider = multiProvider.getEthersV5Provider(chainName);
    } catch {
      // chain not registered — keep confirming so a later render can retry
    }

    if (!provider) {
      scheduleRetry();
      return () => {
        cancelled = true;
        if (retryTimer) clearTimeout(retryTimer);
      };
    }

    const dstIsNative =
      destinationOutcome?.dstIsNative ?? isZeroishAddress(transfer?.dstToken ?? dstToken);
    detectDestinationOutcome(
      provider,
      destinationTxHash,
      recipient!,
      bridgeToken,
      dstToken,
      dstIsNative,
    )
      .then((outcome) => {
        if (cancelled) return;
        const outcomeStatus =
          outcome === 'success'
            ? TransferStatus.ConfirmedDestination
            : outcome === 'failed_recovered'
              ? TransferStatus.FailedRecovered
              : TransferStatus.DestFailed;
        updateStatus(transactionId, outcomeStatus);
        notifyTransferOutcome(transactionId, outcomeStatus);
      })
      .catch(() => {
        if (cancelled) return;
        scheduleRetry();
      });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    transfer?.destinationTxHash,
    transfer?.destinationOutcome,
    transfer?.status,
    transfer?.dstChain,
    transfer?.dstToken,
    transfer?.recipient,
    transactionId,
    route,
    multiProvider,
    updateStatus,
    retryTick,
  ]);
}
