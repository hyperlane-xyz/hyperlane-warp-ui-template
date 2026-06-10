import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';

import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import { FinalSwapStatuses, SwapStatus, type LabeledMsgId } from '../swap/types';
import { TransferStatus } from '../transfer/types';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';

type DeliveryTarget = {
  id: string;
  type: typeof TransactionHistoryItemType.Bridge | typeof TransactionHistoryItemType.Swap;
  msgId: string;
};

export function TransactionDeliveryWatcher() {
  const transactionHistory = useStore((s) => s.transactionHistory);

  const targets = useMemo(
    () =>
      transactionHistory.flatMap((item): DeliveryTarget[] => {
        if (item.type === TransactionHistoryItemType.Bridge) {
          if (
            item.data.status !== TransferStatus.ConfirmedTransfer ||
            !item.data.msgId ||
            item.data.destinationTxHash
          ) {
            return [];
          }
          return [{ id: item.id, type: item.type, msgId: item.data.msgId }];
        }

        if (
          FinalSwapStatuses.includes(item.data.status) ||
          !item.data.msgIds?.length ||
          item.data.destinationTxHash
        ) {
          return [];
        }

        const msgId = getSwapDeliveryMsgId(item.data.msgIds);
        return msgId ? [{ id: item.id, type: item.type, msgId }] : [];
      }),
    [transactionHistory],
  );

  return (
    <>
      {targets.map((target) => (
        <DeliveryTargetWatcher key={`${target.type}-${target.id}-${target.msgId}`} {...target} />
      ))}
    </>
  );
}

function DeliveryTargetWatcher({ id, type, msgId }: DeliveryTarget) {
  const multiProvider = useMultiProvider();
  const updateBridgeTransactionStatus = useStore((s) => s.updateBridgeTransactionStatus);
  const updateSwapTransactionStatus = useStore((s) => s.updateSwapTransactionStatus);
  const delivery = useMessageDeliveryStatus(msgId, true, multiProvider);
  const hasUpdated = useRef(false);

  useEffect(() => {
    hasUpdated.current = false;
  }, [msgId]);

  useEffect(() => {
    if (!delivery.isDelivered || hasUpdated.current) return;
    hasUpdated.current = true;

    if (type === TransactionHistoryItemType.Bridge) {
      updateBridgeTransactionStatus(id, TransferStatus.Delivered, {
        destinationTxHash: delivery.destinationTxHash,
      });
      return;
    }

    updateSwapTransactionStatus(id, SwapStatus.ConfirmedDestination, {
      destinationTxHash: delivery.destinationTxHash,
    });
    toast.success('Swap complete! Funds have arrived.');
  }, [
    delivery.isDelivered,
    delivery.destinationTxHash,
    id,
    type,
    updateBridgeTransactionStatus,
    updateSwapTransactionStatus,
  ]);

  return null;
}

function getSwapDeliveryMsgId(msgIds: LabeledMsgId[]) {
  const normalized = normalizePersistedMsgLabels(msgIds);
  return (
    normalized.find((m) => m.label === 'reveal') ??
    normalized.find((m) => m.label === 'warp') ??
    normalized[0]
  )?.msgId;
}

function normalizePersistedMsgLabels(msgIds: LabeledMsgId[]) {
  if (
    msgIds.length === 3 &&
    msgIds[0]?.label === 'commit' &&
    msgIds[1]?.label === 'reveal' &&
    msgIds[2]?.label === 'reveal'
  ) {
    return [{ ...msgIds[0], label: 'warp' }, { ...msgIds[1], label: 'commit' }, msgIds[2]];
  }
  return msgIds;
}
