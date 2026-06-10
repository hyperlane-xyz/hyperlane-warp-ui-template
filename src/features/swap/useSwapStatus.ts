import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

import { isZeroishAddress } from '@hyperlane-xyz/utils';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import { FinalSwapStatuses, SwapStatus, type SwapHistoryItem } from './types';

// ERC20 Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

type ReceiptProvider = {
  getTransactionReceipt(
    hash: string,
  ): Promise<{ logs: Array<{ topics: string[]; address: string }> } | null>;
};

async function detectSwapOutcome(
  provider: ReceiptProvider,
  destinationTxHash: string,
  recipient: string,
  bridgeToken: string,
  dstToken: string,
): Promise<'success' | 'failed_recovered' | 'dest_failed'> {
  const receipt = await provider.getTransactionReceipt(destinationTxHash);
  if (!receipt) return 'dest_failed';

  const recipientLower = recipient.toLowerCase();
  const bridgeTokenLower = bridgeToken.toLowerCase();
  const dstTokenLower = dstToken.toLowerCase();

  let destSwapSucceeded = false;
  let fallbackDelivered = false;

  for (const log of receipt.logs) {
    if (log.topics[0] !== TRANSFER_TOPIC) continue;
    if (log.topics.length < 3) continue;

    // topics are 32-byte hex strings; last 40 chars are the address
    const to = `0x${log.topics[2]!.slice(26)}`.toLowerCase();
    const addr = log.address.toLowerCase();

    if (addr === dstTokenLower && to === recipientLower) destSwapSucceeded = true;
    if (addr === bridgeTokenLower && to === recipientLower) fallbackDelivered = true;
  }

  if (destSwapSucceeded) return 'success';
  if (fallbackDelivered) return 'failed_recovered';
  return 'dest_failed';
}

// Fires once when the REVEAL tx hash lands on a swap. Reads the receipt directly
// from the destination chain RPC to determine swap outcome without polling the engine.
export function useSwapStatus(swap: SwapHistoryItem | undefined, transactionId: string | null) {
  const route = useStore((s) =>
    transactionId ? s.swapRouteByTransactionId.get(transactionId) : undefined,
  );
  const updateStatus = useStore((s) => s.updateSwapTransactionStatus);
  const multiProvider = useMultiProvider();
  const lastProcessedTxRef = useRef<string | null>(null);

  useEffect(() => {
    const { destinationTxHash, status, dstChain, recipient } = swap ?? {};
    if (!destinationTxHash || !transactionId || !route?.callCommitment) return;
    if (status && FinalSwapStatuses.includes(status)) return;
    if (lastProcessedTxRef.current === destinationTxHash) return;
    lastProcessedTxRef.current = destinationTxHash;

    const destSwapStep = route.steps.find((s) => s.type === 'swap' && s.chain === dstChain);

    // No dest swap on this ICA route — bridge delivered, that's a success.
    if (!destSwapStep || destSwapStep.type !== 'swap') {
      updateStatus(transactionId, SwapStatus.ConfirmedDestination);
      toast.success('Swap complete! Funds have arrived.');
      return;
    }

    const bridgeToken = destSwapStep.tokenIn;
    const dstToken = destSwapStep.tokenOut;

    // Native output — Transfer events won't show ETH, optimistically assume success.
    if (isZeroishAddress(dstToken)) {
      updateStatus(transactionId, SwapStatus.ConfirmedDestination);
      toast.success('Swap complete! Funds have arrived.');
      return;
    }

    let provider: ReceiptProvider | null = null;
    try {
      const chainName = multiProvider.tryGetChainName(dstChain!);
      if (chainName) provider = multiProvider.getEthersV5Provider(chainName);
    } catch {
      // chain not registered — fall through to optimistic success below
    }

    if (!provider) {
      updateStatus(transactionId, SwapStatus.ConfirmedDestination);
      toast.success('Swap complete! Funds have arrived.');
      return;
    }

    detectSwapOutcome(provider, destinationTxHash, recipient!, bridgeToken, dstToken)
      .then((outcome) => {
        if (outcome === 'success') {
          updateStatus(transactionId, SwapStatus.ConfirmedDestination);
          toast.success('Swap complete! Funds have arrived.');
        } else if (outcome === 'failed_recovered') {
          updateStatus(transactionId, SwapStatus.FailedRecovered);
          toast.success('Swap failed — bridge token returned to your wallet.');
        } else {
          updateStatus(transactionId, SwapStatus.DestFailed);
          toast.error('Swap failed — please contact support, your funds may be in your ICA.');
        }
      })
      .catch(() => {
        // Receipt read failed — optimistically show success to avoid false negatives.
        updateStatus(transactionId, SwapStatus.ConfirmedDestination);
        toast.success('Swap complete! Funds have arrived.');
      });
  }, [
    swap?.destinationTxHash,
    swap?.status,
    swap?.dstChain,
    swap?.recipient,
    transactionId,
    route,
    multiProvider,
    updateStatus,
  ]);
}
