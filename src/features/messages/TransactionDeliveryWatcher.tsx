import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk';
import type { MutableRefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';

import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import { FinalSwapStatuses, SwapStatus } from '../transfer/engine/types';
import { useSwapStatus } from '../transfer/engine/useSwapStatus';
import { TransferStatus } from '../transfer/types';
import { useEvmMailboxDeliveryStatus } from './useEvmMailboxDeliveryStatus';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';
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
  requiresDestinationOutcome: boolean;
};

type DeliveryTarget = BridgeDeliveryTarget | SwapDeliveryTarget;

const MAX_BACKGROUND_DELIVERY_TARGETS = 5;

export function TransactionDeliveryWatcher() {
  const multiProvider = useMultiProvider();
  const chainAddresses = useStore((s) => s.chainAddresses);
  const selectedTransactionId = useStore((s) => s.selectedTransactionId);
  const swapRouteByTransactionId = useStore((s) => s.swapRouteByTransactionId);
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
      if (!msgId) return [];

      return [
        {
          id: item.id,
          type: item.type,
          msgId,
          destinationChain,
          status: item.data.status,
          requiresDestinationOutcome:
            !!item.data.destinationOutcome ||
            !!swapRouteByTransactionId.get(item.id)?.callCommitment,
        },
      ];
    });

    return prioritizeSelectedTarget(deliveryTargets, selectedTransactionId).slice(
      -MAX_BACKGROUND_DELIVERY_TARGETS,
    );
  }, [multiProvider, selectedTransactionId, swapRouteByTransactionId, transactionHistory]);

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
  const swap = useStore((s) => {
    if (target.type !== TransactionHistoryItemType.Swap) return undefined;
    const item = s.transactionHistory.find((entry) => entry.id === target.id);
    return item?.type === TransactionHistoryItemType.Swap ? item.data : undefined;
  });
  const graphQlDelivery = useMessageDeliveryStatus(target.msgId, true, multiProvider);
  const mailboxDelivery = useEvmMailboxDeliveryStatus({
    msgId: target.msgId,
    destinationChain:
      target.type === TransactionHistoryItemType.Swap ? target.destinationChain : undefined,
    chainAddresses,
    multiProvider,
    enabled: target.type === TransactionHistoryItemType.Swap && !graphQlDelivery.destinationTxHash,
  });
  // Swap recovery status is centralized here so the modal stays display-only.
  useSwapStatus(swap, target.type === TransactionHistoryItemType.Swap ? target.id : null);
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
      const nextStatus = target.requiresDestinationOutcome
        ? SwapStatus.ConfirmingDestination
        : SwapStatus.ConfirmedDestination;
      updateSwapTransactionStatus(target.id, nextStatus, {
        destinationTxHash: graphQlDelivery.destinationTxHash,
      });
      if (
        !target.requiresDestinationOutcome &&
        target.status !== SwapStatus.ConfirmedDestination &&
        !hasToasted.current
      ) {
        hasToasted.current = true;
        toast.success('Swap complete! Funds have arrived.');
      }
      return;
    }

    if (mailboxDelivery.isDelivered && !hasUpdatedFromMailbox.current) {
      hasUpdatedFromMailbox.current = true;
      const nextStatus = target.requiresDestinationOutcome
        ? SwapStatus.ConfirmingDestination
        : SwapStatus.ConfirmedDestination;
      updateSwapTransactionStatus(target.id, nextStatus, {
        destinationTxHash: mailboxDelivery.destinationTxHash,
      });
      if (
        !target.requiresDestinationOutcome &&
        target.status !== SwapStatus.ConfirmedDestination &&
        !hasToasted.current
      ) {
        hasToasted.current = true;
        toast.success('Swap complete! Funds have arrived.');
      }
    }
  }, [
    graphQlDelivery.destinationTxHash,
    graphQlDelivery.isDelivered,
    mailboxDelivery.destinationTxHash,
    mailboxDelivery.isDelivered,
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
