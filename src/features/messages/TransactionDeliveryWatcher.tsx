import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';

import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import { FinalSwapStatuses, SwapStatus } from '../swap/types';
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
};

type DeliveryTarget = BridgeDeliveryTarget | SwapDeliveryTarget;

const MAX_BACKGROUND_DELIVERY_TARGETS = 5;

export function TransactionDeliveryWatcher() {
  const multiProvider = useMultiProvider();
  const chainAddresses = useStore((s) => s.chainAddresses);
  const transactionHistory = useStore((s) => s.transactionHistory);

  const targets = useMemo(
    () =>
      transactionHistory
        .flatMap((item): DeliveryTarget[] => {
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

          if (item.type !== TransactionHistoryItemType.Swap) return [];

          if (!item.data.msgIds?.length) return [];
          if (FinalSwapStatuses.includes(item.data.status)) {
            if (
              item.data.status !== SwapStatus.ConfirmedDestination ||
              item.data.destinationTxHash
            ) {
              return [];
            }
          }

          const destinationChain = multiProvider.tryGetChainName(item.data.dstChain);
          if (!destinationChain) return [];
          const msgId = getSwapDeliveryMsgId(item.data.msgIds);
          return msgId
            ? [{ id: item.id, type: item.type, msgId, destinationChain, status: item.data.status }]
            : [];
        })
        .slice(-MAX_BACKGROUND_DELIVERY_TARGETS),
    [multiProvider, transactionHistory],
  );

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
  const mailboxDelivery = useEvmMailboxDeliveryStatus({
    msgId: target.msgId,
    destinationChain:
      target.type === TransactionHistoryItemType.Swap ? target.destinationChain : undefined,
    chainAddresses,
    multiProvider,
    enabled: target.type === TransactionHistoryItemType.Swap && !graphQlDelivery.isDelivered,
  });
  const hasToasted = useRef(false);
  const hasUpdatedFromGraphQl = useRef(false);
  const hasUpdatedFromMailbox = useRef(false);

  useEffect(() => {
    hasToasted.current = false;
    hasUpdatedFromGraphQl.current = false;
    hasUpdatedFromMailbox.current = false;
  }, [target.id, target.msgId]);

  useEffect(() => {
    if (target.type === TransactionHistoryItemType.Bridge) {
      if (!graphQlDelivery.isDelivered || hasUpdatedFromGraphQl.current) return;
      hasUpdatedFromGraphQl.current = true;
      updateBridgeTransactionStatus(target.id, TransferStatus.Delivered, {
        destinationTxHash: graphQlDelivery.destinationTxHash,
      });
      return;
    }

    if (graphQlDelivery.isDelivered && !hasUpdatedFromGraphQl.current) {
      hasUpdatedFromGraphQl.current = true;
      updateSwapTransactionStatus(target.id, SwapStatus.ConfirmedDestination, {
        destinationTxHash: graphQlDelivery.destinationTxHash,
      });
      if (!hasToasted.current) {
        hasToasted.current = true;
        toast.success('Swap complete! Funds have arrived.');
      }
      return;
    }

    if (mailboxDelivery.isDelivered && !hasUpdatedFromMailbox.current) {
      hasUpdatedFromMailbox.current = true;
      updateSwapTransactionStatus(target.id, SwapStatus.ConfirmedDestination, {
        destinationTxHash: mailboxDelivery.destinationTxHash,
      });
      if (!hasToasted.current) {
        hasToasted.current = true;
        toast.success('Swap complete! Finalizing details...');
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
