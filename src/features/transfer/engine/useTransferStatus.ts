import { isZeroishAddress } from '@hyperlane-xyz/utils';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { useMultiProvider } from '../../chains/hooks';
import { useStore } from '../../store';
import { FinalTransferStatuses, TransferStatus, type TransferHistoryItem } from './types';

// ERC20 Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DESTINATION_OUTCOME_RETRY_MS = 5_000;

type ReceiptProvider = {
  getTransactionReceipt(
    hash: string,
  ): Promise<{ logs: Array<{ topics: string[]; address: string }> } | null>;
};

async function detectDestinationOutcome(
  provider: ReceiptProvider,
  destinationTxHash: string,
  recipient: string,
  bridgeToken: string,
  dstToken: string,
): Promise<'success' | 'failed_recovered' | 'dest_failed'> {
  const receipt = await provider.getTransactionReceipt(destinationTxHash);
  if (!receipt) throw new Error('Destination transaction receipt not found');

  const recipientLower = recipient.toLowerCase();
  const bridgeTokenLower = bridgeToken.toLowerCase();
  const isNativeOutput = isZeroishAddress(dstToken);
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
  const lastProcessedTxRef = useRef<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRetry = () => {
      retryTimer = setTimeout(() => {
        if (!cancelled) setRetryTick((tick) => tick + 1);
      }, DESTINATION_OUTCOME_RETRY_MS);
    };

    const { destinationTxHash, destinationOutcome, status, dstChain, recipient } = transfer ?? {};
    if (!destinationTxHash || !transactionId) return undefined;
    if (status && FinalTransferStatuses.includes(status)) return undefined;
    if (lastProcessedTxRef.current === destinationTxHash) return undefined;
    lastProcessedTxRef.current = destinationTxHash;

    const destinationSwapStep = route?.steps.find(
      (step): step is Extract<NonNullable<typeof route>['steps'][number], { type: 'swap' }> =>
        step.type === 'swap' && step.chain === dstChain,
    );

    // No destination execution step on this ICA route: cross-chain delivery is success.
    if (
      !destinationOutcome &&
      (!route?.callCommitment || !destinationSwapStep || destinationSwapStep.type !== 'swap')
    ) {
      updateStatus(transactionId, TransferStatus.ConfirmedDestination);
      toast.success('Transfer complete! Funds have arrived.');
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
      lastProcessedTxRef.current = null;
      scheduleRetry();
      return () => {
        cancelled = true;
        if (retryTimer) clearTimeout(retryTimer);
      };
    }

    detectDestinationOutcome(provider, destinationTxHash, recipient!, bridgeToken, dstToken)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome === 'success') {
          updateStatus(transactionId, TransferStatus.ConfirmedDestination);
          toast.success('Transfer complete! Funds have arrived.');
        } else if (outcome === 'failed_recovered') {
          updateStatus(transactionId, TransferStatus.FailedRecovered);
          toast.success('Transfer failed — intermediate token returned to your wallet.');
        } else {
          updateStatus(transactionId, TransferStatus.DestFailed);
          toast.error('Transfer failed — please contact support, your funds may be in your ICA.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        lastProcessedTxRef.current = null;
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
    transfer?.recipient,
    transactionId,
    route,
    multiProvider,
    updateStatus,
    retryTick,
  ]);
}
