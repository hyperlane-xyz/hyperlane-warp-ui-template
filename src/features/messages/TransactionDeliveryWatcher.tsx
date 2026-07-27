import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk';
import type { MutableRefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';

import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import {
  FinalTransferStatuses,
  TransferStatus,
  type TransferHistoryItem,
} from '../transfer/engine/types';
import { useTransferStatus } from '../transfer/engine/useTransferStatus';
import { useEvmMailboxDeliveryStatus } from './useEvmMailboxDeliveryStatus';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';
import { type OriginTxMessagesResult, useOriginTxMessages } from './useOriginTxMessages';
import { useSolanaDestSwapStatus } from './useSolanaDestSwapStatus';
import { useSolanaMailboxDeliveryStatus } from './useSolanaMailboxDeliveryStatus';
import { getTransferDeliveryMsgId } from './utils';

type TransferDeliveryTarget = {
  id: string;
  type: typeof TransactionHistoryItemType.Transfer;
  msgId?: string;
  originTxHash?: string;
  originDomainId: number;
  destinationChain: ChainName;
  status: TransferStatus;
  solanaDestSwapPda: string | undefined;
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

      if (FinalTransferStatuses.includes(item.data.status)) {
        if (
          item.data.status !== TransferStatus.ConfirmedDestination ||
          item.data.destinationTxHash ||
          item.data.solanaDestSwapPda
        ) {
          return [];
        }
      }

      const destinationChain = multiProvider.tryGetChainName(item.data.dstChain);
      if (!destinationChain) return [];
      const msgId = getTransferDeliveryMsgId(item.data.msgIds);
      if (!msgId && !item.data.originTxHash) return [];

      return [
        {
          id: item.id,
          type: item.type,
          msgId,
          originTxHash: item.data.originTxHash,
          originDomainId: item.data.srcChain,
          destinationChain,
          status: item.data.status,
          solanaDestSwapPda: item.data.solanaDestSwapPda,
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
          key={`${target.type}-${target.id}-${target.msgId ?? target.originTxHash}`}
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
  const transferRouteByTransactionId = useStore((s) => s.transferRouteByTransactionId);
  const transfer = useStore((s) => {
    if (target.type !== TransactionHistoryItemType.Transfer) return undefined;
    const item = s.transactionHistory.find((entry) => entry.id === target.id);
    return item?.type === TransactionHistoryItemType.Transfer ? item.data : undefined;
  });
  const graphQlDelivery = useMessageDeliveryStatus(target.msgId, true, multiProvider);
  const originTxMessages = useOriginTxMessages(
    target.msgId ? undefined : target.originTxHash,
    target.originDomainId,
    transferRouteByTransactionId.get(target.id),
    !target.msgId,
    multiProvider,
  );
  const mailboxDelivery = useEvmMailboxDeliveryStatus({
    msgId: target.msgId,
    destinationChain: target.destinationChain,
    chainAddresses,
    multiProvider,
    enabled: !!target.msgId && !graphQlDelivery.destinationTxHash,
  });
  const solanaMailboxDelivery = useSolanaMailboxDeliveryStatus({
    msgId: target.msgId,
    destinationChain: target.destinationChain,
    chainAddresses,
    multiProvider,
    enabled: !!target.msgId && !graphQlDelivery.isDelivered && !mailboxDelivery.isDelivered,
  });

  const bridgeDelivered =
    graphQlDelivery.isDelivered ||
    mailboxDelivery.isDelivered ||
    solanaMailboxDelivery.isDelivered ||
    target.status === TransferStatus.ConfirmingDestination;
  const solanaDestSwap = useSolanaDestSwapStatus({
    pdaAddress: target.solanaDestSwapPda,
    destinationChain: target.destinationChain,
    multiProvider,
    enabled: !!target.solanaDestSwapPda && bridgeDelivered,
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
  const hasUpdatedFromDestSwap = useRef(false);

  useEffect(() => {
    hasToasted.current = false;
    hasUpdatedFromGraphQl.current = false;
    hasBackfilledGraphQlHash.current = false;
    hasUpdatedFromMailbox.current = false;
    hasUpdatedFromDestSwap.current = false;
  }, [target.id, target.msgId, target.originTxHash]);

  useEffect(() => {
    if (originTxMessages.msgIds?.length) {
      const nextStatus = originTxMessages.isDelivered
        ? target.requiresDestinationOutcome
          ? TransferStatus.ConfirmingDestination
          : TransferStatus.ConfirmedDestination
        : TransferStatus.Bridging;
      if (shouldUpdateFromOriginTx(transfer, nextStatus, originTxMessages)) {
        updateTransferTransactionStatus(target.id, nextStatus, {
          msgIds: originTxMessages.msgIds,
          originBlockNumber: originTxMessages.originBlockHeight,
          originTxTimestamp: originTxMessages.originTimestamp
            ? Math.floor(originTxMessages.originTimestamp / 1000)
            : undefined,
          destinationTxHash: originTxMessages.destinationTxHash,
        });
      }
      if (
        originTxMessages.isDelivered &&
        !target.requiresDestinationOutcome &&
        target.status !== TransferStatus.ConfirmedDestination &&
        !hasToasted.current
      ) {
        hasToasted.current = true;
        toast.success('Transfer complete! Funds have arrived.');
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

    const isDirectDelivered = mailboxDelivery.isDelivered || solanaMailboxDelivery.isDelivered;
    const directDeliveryTxHash = mailboxDelivery.isDelivered
      ? mailboxDelivery.destinationTxHash
      : solanaMailboxDelivery.destinationTxHash;
    if (isDirectDelivered && !hasUpdatedFromMailbox.current) {
      hasUpdatedFromMailbox.current = true;
      const nextStatus = target.requiresDestinationOutcome
        ? TransferStatus.ConfirmingDestination
        : TransferStatus.ConfirmedDestination;
      updateTransferTransactionStatus(target.id, nextStatus, {
        destinationTxHash: directDeliveryTxHash,
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
    originTxMessages,
    originTxMessages.destinationTxHash,
    originTxMessages.isDelivered,
    originTxMessages.msgIds,
    originTxMessages.originBlockHeight,
    originTxMessages.originTimestamp,
    solanaMailboxDelivery.destinationTxHash,
    solanaMailboxDelivery.isDelivered,
    target,
    transfer,
    updateTransferTransactionStatus,
  ]);

  useEffect(() => {
    if (!solanaDestSwap.isDone || hasUpdatedFromDestSwap.current) return;
    hasUpdatedFromDestSwap.current = true;
    updateTransferTransactionStatus(target.id, TransferStatus.ConfirmedDestination);
    if (target.status !== TransferStatus.ConfirmedDestination && !hasToasted.current) {
      hasToasted.current = true;
      toast.success('Transfer complete! Funds have arrived.');
    }
  }, [solanaDestSwap.isDone, target, updateTransferTransactionStatus]);

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

export function shouldUpdateFromOriginTx(
  transfer: TransferHistoryItem | undefined,
  nextStatus: TransferStatus,
  originTxMessages: OriginTxMessagesResult,
) {
  if (!transfer) return true;

  const nextOriginTxTimestamp = originTxMessages.originTimestamp
    ? Math.floor(originTxMessages.originTimestamp / 1000)
    : undefined;

  return (
    transfer.status !== nextStatus ||
    shouldBackfillMsgIds(transfer.msgIds, originTxMessages.msgIds) ||
    (transfer.originBlockNumber == null && originTxMessages.originBlockHeight != null) ||
    (transfer.originTxTimestamp == null && nextOriginTxTimestamp != null) ||
    (transfer.destinationTxHash == null && originTxMessages.destinationTxHash != null)
  );
}

function shouldBackfillMsgIds(
  current: Array<{ msgId: string; label: string }> | undefined,
  recovered: Array<{ msgId: string; label: string }> | undefined,
) {
  return !!recovered?.length && (!current || current.length === 0);
}

export function prioritizeSelectedTarget<T extends { id: string }>(
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
