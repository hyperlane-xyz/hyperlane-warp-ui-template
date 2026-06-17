import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk';
import type { MutableRefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';

import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import { FinalTransferStatuses, TransferStatus } from '../transfer/engine/types';
import { useTransferStatus } from '../transfer/engine/useTransferStatus';
import { useEvmMailboxDeliveryStatus } from './useEvmMailboxDeliveryStatus';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';
import { getTransferDeliveryMsgId } from './utils';

type TransferDeliveryTarget = {
  id: string;
  type: typeof TransactionHistoryItemType.Transfer;
  msgId: string;
  destinationChain: ChainName;
  status: TransferStatus;
  requiresDestinationOutcome: boolean;
};

type DeliveryTarget = TransferDeliveryTarget;

const MAX_BACKGROUND_DELIVERY_TARGETS = 5;

export function TransactionDeliveryWatcher() {
  const multiProvider = useMultiProvider();
  const chainAddresses = useStore((s) => s.chainAddresses);
  const selectedTransactionId = useStore((s) => s.selectedTransactionId);
  const transferRouteByTransactionId = useStore((s) => s.transferRouteByTransactionId);
  const transactionHistory = useStore((s) => s.transactionHistory);

  const targets = useMemo(() => {
    const deliveryTargets = transactionHistory.flatMap((item): DeliveryTarget[] => {
      if (item.type !== TransactionHistoryItemType.Transfer) return [];

      if (!item.data.msgIds?.length) return [];
      if (FinalTransferStatuses.includes(item.data.status)) {
        if (
          item.data.status !== TransferStatus.ConfirmedDestination ||
          item.data.destinationTxHash
        ) {
          return [];
        }
      }

      const destinationChain = multiProvider.tryGetChainName(item.data.dstChain);
      if (!destinationChain) return [];
      const msgId = getTransferDeliveryMsgId(item.data.msgIds);
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
            !!transferRouteByTransactionId.get(item.id)?.callCommitment,
        },
      ];
    });

    return prioritizeSelectedTarget(deliveryTargets, selectedTransactionId).slice(
      -MAX_BACKGROUND_DELIVERY_TARGETS,
    );
  }, [multiProvider, selectedTransactionId, transferRouteByTransactionId, transactionHistory]);

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
  const updateTransferTransactionStatus = useStore((s) => s.updateTransferTransactionStatus);
  const transfer = useStore((s) => {
    if (target.type !== TransactionHistoryItemType.Transfer) return undefined;
    const item = s.transactionHistory.find((entry) => entry.id === target.id);
    return item?.type === TransactionHistoryItemType.Transfer ? item.data : undefined;
  });
  const graphQlDelivery = useMessageDeliveryStatus(target.msgId, true, multiProvider);
  const mailboxDelivery = useEvmMailboxDeliveryStatus({
    msgId: target.msgId,
    destinationChain: target.destinationChain,
    chainAddresses,
    multiProvider,
    enabled: !graphQlDelivery.destinationTxHash,
  });
  // Transfer recovery status is centralized here so the modal stays display-only.
  useTransferStatus(
    transfer,
    target.type === TransactionHistoryItemType.Transfer ? target.id : null,
  );
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
        ? TransferStatus.ConfirmingDestination
        : TransferStatus.ConfirmedDestination;
      updateTransferTransactionStatus(target.id, nextStatus, {
        destinationTxHash: graphQlDelivery.destinationTxHash,
      });
      if (
        !target.requiresDestinationOutcome &&
        target.status !== TransferStatus.ConfirmedDestination &&
        !hasToasted.current
      ) {
        hasToasted.current = true;
        toast.success('Transfer complete! Funds have arrived.');
      }
      return;
    }

    if (mailboxDelivery.isDelivered && !hasUpdatedFromMailbox.current) {
      hasUpdatedFromMailbox.current = true;
      const nextStatus = target.requiresDestinationOutcome
        ? TransferStatus.ConfirmingDestination
        : TransferStatus.ConfirmedDestination;
      updateTransferTransactionStatus(target.id, nextStatus, {
        destinationTxHash: mailboxDelivery.destinationTxHash,
      });
      if (
        !target.requiresDestinationOutcome &&
        target.status !== TransferStatus.ConfirmedDestination &&
        !hasToasted.current
      ) {
        hasToasted.current = true;
        toast.success('Transfer complete! Funds have arrived.');
      }
    }
  }, [
    graphQlDelivery.destinationTxHash,
    graphQlDelivery.isDelivered,
    mailboxDelivery.destinationTxHash,
    mailboxDelivery.isDelivered,
    target,
    updateTransferTransactionStatus,
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
