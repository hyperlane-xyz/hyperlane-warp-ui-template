import type { ChainName } from '@hyperlane-xyz/sdk';
import { useEffect, useMemo, useRef } from 'react';

import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import {
  FinalTransferStatuses,
  TransferStatus,
  type TransferHistoryItem,
} from '../transfer/engine/types';
import { notifyTransferOutcome, useTransferStatus } from '../transfer/engine/useTransferStatus';
import { useMessageDeliveryStatus, type MessageDeliveryResult } from './useMessageDeliveryStatus';
import { useWatchMessages } from './useMessageStream';
import { useSolanaDestSwapStatus } from './useSolanaDestSwapStatus';
import { getTransferDeliveryMsgId } from './utils';

type DeliveryTarget = {
  id: string;
  msgId?: string;
  originTxHash?: string;
  originDomainId: number;
  destinationChain: ChainName;
  status: TransferStatus;
  solanaDestSwapPda: string | undefined;
  requiresDestinationOutcome: boolean;
};

const MAX_BACKGROUND_DELIVERY_TARGETS = 5;

export function TransactionDeliveryWatcher() {
  const multiProvider = useMultiProvider();
  const selectedTransactionId = useStore((s) => s.selectedTransactionId);
  const transferRouteByTransactionId = useStore((s) => s.transferRouteByTransactionId);
  const transactionHistory = useStore((s) => s.transactionHistory);

  const targets = useMemo(() => {
    const deliveryTargets = transactionHistory.flatMap((item): DeliveryTarget[] => {
      if (item.type !== TransactionHistoryItemType.Transfer) return [];

      if (!shouldWatchTransfer(item.data)) return [];

      const destinationChain = multiProvider.tryGetChainName(item.data.dstChain);
      if (!destinationChain) return [];
      const msgId = getTransferDeliveryMsgId(item.data.msgIds);
      if (!msgId && !item.data.originTxHash) return [];

      return [
        {
          id: item.id,
          msgId,
          originTxHash: item.data.originTxHash,
          originDomainId: item.data.srcChain,
          destinationChain,
          status: item.data.status,
          solanaDestSwapPda: item.data.solanaDestSwapPda,
          requiresDestinationOutcome:
            !!item.data.solanaDestSwapPda ||
            !!item.data.destinationOutcome ||
            !!transferRouteByTransactionId.get(item.id)?.callCommitment,
        },
      ];
    });

    return prioritizeSelectedTarget(deliveryTargets, selectedTransactionId).slice(
      -MAX_BACKGROUND_DELIVERY_TARGETS,
    );
  }, [multiProvider, selectedTransactionId, transferRouteByTransactionId, transactionHistory]);

  // Watch every message in each active swap, including bridge, commit, and reveal.
  const watchedTransfers = transactionHistory.flatMap((item) =>
    item.type === TransactionHistoryItemType.Transfer &&
    item.data.srcChain !== item.data.dstChain &&
    (item.id === selectedTransactionId || targets.some((target) => target.id === item.id)) &&
    (item.data.originTxHash || item.data.msgIds?.length)
      ? [item.data]
      : [],
  );
  useWatchMessages(
    watchedTransfers.flatMap(({ srcChain, dstChain }) =>
      [srcChain, dstChain].flatMap((chain) => {
        const domain = multiProvider.tryGetDomainId(chain);
        return domain == null ? [] : [domain];
      }),
    ),
    watchedTransfers.flatMap((transfer) => transfer.msgIds?.map(({ msgId }) => msgId) ?? []),
  );

  return (
    <>
      {targets.map((target) => (
        <DeliveryTargetWatcher key={target.id} target={target} />
      ))}
    </>
  );
}

function DeliveryTargetWatcher({ target }: { target: DeliveryTarget }) {
  const multiProvider = useMultiProvider();
  const updateTransferTransactionStatus = useStore((s) => s.updateTransferTransactionStatus);
  const transferRouteByTransactionId = useStore((s) => s.transferRouteByTransactionId);
  const transfer = useStore((s) => {
    const item = s.transactionHistory.find((entry) => entry.id === target.id);
    return item?.type === TransactionHistoryItemType.Transfer ? item.data : undefined;
  });
  const delivery = useMessageDeliveryStatus(
    target.msgId
      ? { msgId: target.msgId }
      : target.originTxHash
        ? {
            originTxHash: target.originTxHash,
            originDomainId: target.originDomainId,
            route: transferRouteByTransactionId.get(target.id),
          }
        : undefined,
    true,
    multiProvider,
  );
  const bridgeDelivered =
    delivery.isDelivered || target.status === TransferStatus.ConfirmingDestination;
  const solanaDestSwap = useSolanaDestSwapStatus({
    pdaAddress: target.solanaDestSwapPda,
    destinationChain: target.destinationChain,
    multiProvider,
    enabled: !!target.solanaDestSwapPda && bridgeDelivered,
  });

  const hasToasted = useRef(false);

  useEffect(() => {
    if (!delivery.isDelivered && !delivery.msgIds?.length) return;
    const nextStatus = delivery.isDelivered
      ? target.requiresDestinationOutcome
        ? TransferStatus.ConfirmingDestination
        : TransferStatus.ConfirmedDestination
      : TransferStatus.Bridging;
    if (!shouldUpdateFromOriginTx(transfer, nextStatus, delivery)) return;
    updateTransferTransactionStatus(target.id, nextStatus, {
      msgIds: delivery.msgIds,
      originBlockNumber: delivery.originBlockHeight,
      originTxTimestamp: delivery.originTimestamp
        ? Math.floor(delivery.originTimestamp / 1000)
        : undefined,
      destinationTxHash: delivery.destinationTxHash,
    });
    if (
      nextStatus === TransferStatus.ConfirmedDestination &&
      target.status !== nextStatus &&
      !hasToasted.current
    ) {
      hasToasted.current = true;
      notifyTransferOutcome(target.id, nextStatus);
    }
  }, [delivery, target, transfer, updateTransferTransactionStatus]);

  // Process execution after delivery updates. Solana uses its swap PDA; EVM uses receipts.
  useTransferStatus(target.solanaDestSwapPda ? undefined : transfer, target.id);

  useEffect(() => {
    if (!solanaDestSwap.isDone || target.status === TransferStatus.ConfirmedDestination) return;
    updateTransferTransactionStatus(target.id, TransferStatus.ConfirmedDestination);
    if (!hasToasted.current) {
      hasToasted.current = true;
      notifyTransferOutcome(target.id, TransferStatus.ConfirmedDestination);
    }
  }, [solanaDestSwap.isDone, target, updateTransferTransactionStatus]);

  return null;
}

export function shouldUpdateFromOriginTx(
  transfer: TransferHistoryItem | undefined,
  nextStatus: TransferStatus,
  originTxMessages: MessageDeliveryResult,
) {
  if (!transfer) return true;

  return (
    transfer.status !== nextStatus ||
    (!!originTxMessages.msgIds?.length && !transfer.msgIds?.length) ||
    (transfer.originBlockNumber == null && originTxMessages.originBlockHeight != null) ||
    (transfer.originTxTimestamp == null && !!originTxMessages.originTimestamp) ||
    (transfer.destinationTxHash == null && originTxMessages.destinationTxHash != null)
  );
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

export function shouldWatchTransfer(data: TransferHistoryItem): boolean {
  if (data.srcChain === data.dstChain) return false;
  if (!FinalTransferStatuses.includes(data.status)) return true;
  if (data.status === TransferStatus.Failed)
    return !!data.originTxHash || !!getTransferDeliveryMsgId(data.msgIds);
  return (
    data.status === TransferStatus.ConfirmedDestination &&
    !data.destinationTxHash &&
    !data.solanaDestSwapPda
  );
}
