import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk';
import type { MutableRefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';

import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import { FinalSwapStatuses, SwapStatus } from '../swap/types';
import { TransferStatus } from '../transfer/types';
import { useEvmMailboxDeliveryStatus } from './useEvmMailboxDeliveryStatus';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';
import { useSolanaMailboxDeliveryStatus } from './useSolanaMailboxDeliveryStatus';
import { getSwapDeliveryMsgId } from './utils';

type BridgeDeliveryTarget = {
  id: string;
  type: typeof TransactionHistoryItemType.Bridge;
  msgId: string;
};

type SwapDeliveryTarget = {
  id: string;
  type: typeof TransactionHistoryItemType.Swap;
  msgId: string;
  destinationChain: ChainName;
  status: SwapStatus;
  // True when a Solana reveal is pending — delivery watcher must not auto-complete;
  // the reveal modal handles ConfirmedDestination after the reveal tx confirms.
  hasSolanaReveal: boolean;
};

type DeliveryTarget = BridgeDeliveryTarget | SwapDeliveryTarget;

const MAX_BACKGROUND_DELIVERY_TARGETS = 5;

export function TransactionDeliveryWatcher() {
  const multiProvider = useMultiProvider();
  const chainAddresses = useStore((s) => s.chainAddresses);
  const selectedTransactionId = useStore((s) => s.selectedTransactionId);
  const transactionHistory = useStore((s) => s.transactionHistory);

  const targets = useMemo(() => {
    const deliveryTargets = transactionHistory.flatMap((item): DeliveryTarget[] => {
      if (item.type === TransactionHistoryItemType.Bridge) {
        const shouldWatchBridge =
          item.data.status === TransferStatus.ConfirmedTransfer ||
          item.data.status === TransferStatus.Delivered;
        if (!shouldWatchBridge || !item.data.msgId || item.data.destinationTxHash) {
          return [];
        }
        return [{ id: item.id, type: item.type, msgId: item.data.msgId }];
      }

      if (item.type !== TransactionHistoryItemType.Swap) return [];

      if (!item.data.msgIds?.length) return [];
      if (FinalSwapStatuses.includes(item.data.status)) {
        if (item.data.status !== SwapStatus.ConfirmedDestination || item.data.destinationTxHash) {
          return [];
        }
      }

      const destinationChain = multiProvider.tryGetChainName(item.data.dstChain);
      if (!destinationChain) return [];
      const msgId = getSwapDeliveryMsgId(item.data.msgIds);
      const hasSolanaReveal = !!(item.data.solanaReveal && !item.data.revealDismissed);
      return msgId
        ? [{ id: item.id, type: item.type, msgId, destinationChain, status: item.data.status, hasSolanaReveal }]
        : [];
    });

    return prioritizeSelectedTarget(deliveryTargets, selectedTransactionId).slice(
      -MAX_BACKGROUND_DELIVERY_TARGETS,
    );
  }, [multiProvider, selectedTransactionId, transactionHistory]);

  return (
    <>
      {targets.map((target) => (
        <DeliveryTargetWatcher
          key={`${target.type}-${target.id}-${target.msgId}`}
          target={target}
          chainAddresses={chainAddresses}
        />
      ))}
    </>
  );
}

function DeliveryTargetWatcher({
  target,
  chainAddresses,
}: {
  target: DeliveryTarget;
  chainAddresses: ChainMap<ChainAddresses>;
}) {
  const multiProvider = useMultiProvider();
  const updateBridgeTransactionStatus = useStore((s) => s.updateBridgeTransactionStatus);
  const updateSwapTransactionStatus = useStore((s) => s.updateSwapTransactionStatus);
  const graphQlDelivery = useMessageDeliveryStatus(target.msgId, true, multiProvider);
  const isSwapTarget = target.type === TransactionHistoryItemType.Swap;
  const swapDestChain = isSwapTarget ? target.destinationChain : undefined;
  const mailboxDelivery = useEvmMailboxDeliveryStatus({
    msgId: target.msgId,
    destinationChain: swapDestChain,
    chainAddresses,
    multiProvider,
    enabled: isSwapTarget && !graphQlDelivery.isDelivered,
  });
  const solanaMailboxDelivery = useSolanaMailboxDeliveryStatus({
    msgId: target.msgId,
    destinationChain: swapDestChain,
    chainAddresses,
    multiProvider,
    enabled: isSwapTarget && !graphQlDelivery.isDelivered && !mailboxDelivery.isDelivered,
  });
  const hasToasted = useRef(false);
  const hasUpdatedFromGraphQl = useRef(false);
  const hasBackfilledGraphQlHash = useRef(false);
  const hasUpdatedFromMailbox = useRef(false);

  useEffect(() => {
    hasToasted.current = false;
    hasUpdatedFromGraphQl.current = false;
    hasBackfilledGraphQlHash.current = false;
    hasUpdatedFromMailbox.current = false;
  }, [target.id, target.msgId]);

  useEffect(() => {
    if (target.type === TransactionHistoryItemType.Bridge) {
      if (
        !graphQlDelivery.isDelivered ||
        !shouldUpdateFromDelivery(
          hasUpdatedFromGraphQl,
          hasBackfilledGraphQlHash,
          graphQlDelivery.destinationTxHash,
        )
      ) {
        return;
      }
      hasUpdatedFromGraphQl.current = true;
      if (graphQlDelivery.destinationTxHash) hasBackfilledGraphQlHash.current = true;
      updateBridgeTransactionStatus(target.id, TransferStatus.Delivered, {
        destinationTxHash: graphQlDelivery.destinationTxHash,
      });
      return;
    }

    // Solana CCS swaps: warp delivery signals "ready for reveal". Update to
    // ConfirmingDestination so the reveal modal knows to open. The modal sets
    // ConfirmedDestination after the reveal tx confirms.
    if (target.type === TransactionHistoryItemType.Swap && target.hasSolanaReveal) {
      const directDelivery = mailboxDelivery.isDelivered ? mailboxDelivery : solanaMailboxDelivery;
      if (
        (graphQlDelivery.isDelivered || directDelivery.isDelivered) &&
        !hasUpdatedFromMailbox.current
      ) {
        hasUpdatedFromMailbox.current = true;
        updateSwapTransactionStatus(target.id, SwapStatus.ConfirmingDestination);
      }
      return;
    }

    if (
      graphQlDelivery.isDelivered &&
      shouldUpdateFromDelivery(
        hasUpdatedFromGraphQl,
        hasBackfilledGraphQlHash,
        graphQlDelivery.destinationTxHash,
      )
    ) {
      hasUpdatedFromGraphQl.current = true;
      if (graphQlDelivery.destinationTxHash) hasBackfilledGraphQlHash.current = true;
      updateSwapTransactionStatus(target.id, SwapStatus.ConfirmedDestination, {
        destinationTxHash: graphQlDelivery.destinationTxHash,
      });
      if (target.status !== SwapStatus.ConfirmedDestination && !hasToasted.current) {
        hasToasted.current = true;
        toast.success('Swap complete! Funds have arrived.');
      }
      return;
    }

    const directDelivery = mailboxDelivery.isDelivered ? mailboxDelivery : solanaMailboxDelivery;
    if (directDelivery.isDelivered && !hasUpdatedFromMailbox.current) {
      hasUpdatedFromMailbox.current = true;
      updateSwapTransactionStatus(target.id, SwapStatus.ConfirmedDestination, {
        destinationTxHash: directDelivery.destinationTxHash,
      });
      if (target.status !== SwapStatus.ConfirmedDestination && !hasToasted.current) {
        hasToasted.current = true;
        toast.success('Swap complete! Funds have arrived.');
      }
    }
  }, [
    graphQlDelivery.destinationTxHash,
    graphQlDelivery.isDelivered,
    mailboxDelivery.destinationTxHash,
    mailboxDelivery.isDelivered,
    solanaMailboxDelivery.isDelivered,
    target,
    updateBridgeTransactionStatus,
    updateSwapTransactionStatus,
  ]);

  return null;
}

function shouldUpdateFromDelivery(
  hasUpdated: MutableRefObject<boolean>,
  hasBackfilledHash: MutableRefObject<boolean>,
  destinationTxHash: string | undefined,
) {
  if (!hasUpdated.current) return true;
  return !!destinationTxHash && !hasBackfilledHash.current;
}

function prioritizeSelectedTarget<T extends { id: string }>(
  targets: T[],
  selectedTransactionId: string | null | undefined,
) {
  if (!selectedTransactionId) return targets;

  const selectedIndex = targets.findIndex((target) => target.id === selectedTransactionId);
  if (selectedIndex === -1) return targets;

  return [
    ...targets.slice(0, selectedIndex),
    ...targets.slice(selectedIndex + 1),
    targets[selectedIndex],
  ];
}
