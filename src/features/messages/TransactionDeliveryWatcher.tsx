import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';

import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import { SwapStatus } from '../swap/types';
import { useSwapStatus } from '../swap/useSwapStatus';
import { TransferStatus } from '../transfer/types';
import { useEvmMailboxDeliveryStatus } from './useEvmMailboxDeliveryStatus';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';
import { useOriginTxSwapMessages } from './useOriginTxSwapMessages';
import { useSolanaDestSwapStatus } from './useSolanaDestSwapStatus';
import { useSolanaMailboxDeliveryStatus } from './useSolanaMailboxDeliveryStatus';
import {
  getSwapDeliveryMsgId,
  prioritizeSelectedTarget,
  shouldUpdateFromDelivery,
  shouldWatchSwapDeliveryStatus,
} from './utils';

type BridgeDeliveryTarget = {
  id: string;
  type: typeof TransactionHistoryItemType.Bridge;
  msgId: string;
};

type SwapDeliveryTarget = {
  id: string;
  type: typeof TransactionHistoryItemType.Swap;
  msgId: string | undefined;
  originTxHash: string | undefined;
  originDomainId: number;
  destinationChain: ChainName;
  status: SwapStatus;
  requiresDestinationOutcome: boolean;
  solanaDestSwapPda: string | undefined;
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

      if (!shouldWatchSwapDeliveryStatus(item.data)) return [];

      const destinationChain = multiProvider.tryGetChainName(item.data.dstChain);
      if (!destinationChain) return [];
      const msgId = getSwapDeliveryMsgId(item.data.msgIds);
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
          key={`${target.type}-${target.id}-${
            target.type === TransactionHistoryItemType.Swap
              ? (target.msgId ?? target.originTxHash)
              : target.msgId
          }`}
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
  const isSwapTarget = target.type === TransactionHistoryItemType.Swap;
  const swapRoute = useStore((s) =>
    isSwapTarget ? s.swapRouteByTransactionId.get(target.id) : undefined,
  );
  const swapDestinationChain = isSwapTarget ? target.destinationChain : undefined;
  const originTxMessages = useOriginTxSwapMessages(
    isSwapTarget && !target.msgId ? target.originTxHash : undefined,
    isSwapTarget ? target.originDomainId : undefined,
    swapRoute,
    isSwapTarget && !target.msgId,
    multiProvider,
  );
  const targetOriginTxHash = isSwapTarget ? target.originTxHash : undefined;
  const effectiveMsgId =
    target.type === TransactionHistoryItemType.Swap
      ? (target.msgId ?? getSwapDeliveryMsgId(originTxMessages.msgIds))
      : target.msgId;
  const graphQlDelivery = useMessageDeliveryStatus(effectiveMsgId, true, multiProvider);
  const mailboxDelivery = useEvmMailboxDeliveryStatus({
    msgId: effectiveMsgId ?? '',
    destinationChain: swapDestinationChain,
    chainAddresses,
    multiProvider,
    enabled: isSwapTarget && !!effectiveMsgId && !graphQlDelivery.destinationTxHash,
  });
  const solanaMailboxDelivery = useSolanaMailboxDeliveryStatus({
    msgId: effectiveMsgId ?? '',
    destinationChain: swapDestinationChain,
    chainAddresses,
    multiProvider,
    enabled:
      isSwapTarget &&
      !!effectiveMsgId &&
      !graphQlDelivery.isDelivered &&
      !mailboxDelivery.isDelivered,
  });
  const bridgeDelivered =
    graphQlDelivery.isDelivered ||
    mailboxDelivery.isDelivered ||
    solanaMailboxDelivery.isDelivered ||
    (isSwapTarget && target.status === SwapStatus.ConfirmingDestination);
  const solanaDestSwap = useSolanaDestSwapStatus({
    pdaAddress: isSwapTarget ? target.solanaDestSwapPda : undefined,
    destinationChain: swapDestinationChain,
    multiProvider,
    enabled: isSwapTarget && !!target.solanaDestSwapPda && bridgeDelivered,
  });
  // Swap recovery status is centralized here so the modal stays display-only.
  useSwapStatus(swap, isSwapTarget ? target.id : null);
  const hasToasted = useRef(false);
  const hasUpdatedFromGraphQl = useRef(false);
  const hasBackfilledGraphQlHash = useRef(false);
  const hasUpdatedFromMailbox = useRef(false);
  const hasBackfilledMailboxHash = useRef(false);
  const hasUpdatedFromSolanaDestSwap = useRef(false);
  const hasRecoveredOriginTxMessages = useRef(false);

  useEffect(() => {
    hasToasted.current = false;
    hasUpdatedFromGraphQl.current = false;
    hasBackfilledGraphQlHash.current = false;
    hasUpdatedFromMailbox.current = false;
    hasBackfilledMailboxHash.current = false;
    hasUpdatedFromSolanaDestSwap.current = false;
    hasRecoveredOriginTxMessages.current = false;
  }, [target.id, target.msgId, targetOriginTxHash]);

  useEffect(() => {
    if (target.type === TransactionHistoryItemType.Bridge) {
      if (
        !graphQlDelivery.isDelivered ||
        !shouldUpdateFromDelivery(
          {
            hasUpdated: hasUpdatedFromGraphQl.current,
            hasBackfilledHash: hasBackfilledGraphQlHash.current,
          },
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

    if (originTxMessages.msgIds?.length && !hasRecoveredOriginTxMessages.current) {
      hasRecoveredOriginTxMessages.current = true;
      const nextStatus = originTxMessages.isDelivered
        ? target.requiresDestinationOutcome
          ? SwapStatus.ConfirmingDestination
          : SwapStatus.ConfirmedDestination
        : SwapStatus.Bridging;
      updateSwapTransactionStatus(target.id, nextStatus, {
        msgIds: originTxMessages.msgIds,
        originBlockNumber: originTxMessages.originBlockHeight,
        originTxTimestamp: originTxMessages.originTimestamp
          ? Math.floor(originTxMessages.originTimestamp / 1000)
          : undefined,
        destinationTxHash: originTxMessages.destinationTxHash,
      });
      if (
        originTxMessages.isDelivered &&
        !target.requiresDestinationOutcome &&
        target.status !== SwapStatus.ConfirmedDestination &&
        !hasToasted.current
      ) {
        hasToasted.current = true;
        toast.success('Swap complete! Funds have arrived.');
      }
      return;
    }

    if (
      graphQlDelivery.isDelivered &&
      shouldUpdateFromDelivery(
        {
          hasUpdated: hasUpdatedFromGraphQl.current,
          hasBackfilledHash: hasBackfilledGraphQlHash.current,
        },
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

    const isDirectDelivered = mailboxDelivery.isDelivered || solanaMailboxDelivery.isDelivered;
    const directDestinationTxHash = mailboxDelivery.isDelivered
      ? mailboxDelivery.destinationTxHash
      : solanaMailboxDelivery.destinationTxHash;
    if (
      isDirectDelivered &&
      shouldUpdateFromDelivery(
        {
          hasUpdated: hasUpdatedFromMailbox.current,
          hasBackfilledHash: hasBackfilledMailboxHash.current,
        },
        directDestinationTxHash,
      )
    ) {
      hasUpdatedFromMailbox.current = true;
      if (directDestinationTxHash) hasBackfilledMailboxHash.current = true;
      const nextStatus = target.requiresDestinationOutcome
        ? SwapStatus.ConfirmingDestination
        : SwapStatus.ConfirmedDestination;
      updateSwapTransactionStatus(target.id, nextStatus, {
        destinationTxHash: directDestinationTxHash,
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
    originTxMessages.destinationTxHash,
    originTxMessages.isDelivered,
    originTxMessages.msgIds,
    originTxMessages.originBlockHeight,
    originTxMessages.originTimestamp,
    solanaMailboxDelivery.destinationTxHash,
    solanaMailboxDelivery.isDelivered,
    target,
    updateBridgeTransactionStatus,
    updateSwapTransactionStatus,
  ]);

  useEffect(() => {
    if (!isSwapTarget || !solanaDestSwap.isDone || hasUpdatedFromSolanaDestSwap.current) {
      return;
    }
    hasUpdatedFromSolanaDestSwap.current = true;
    updateSwapTransactionStatus(target.id, SwapStatus.ConfirmedDestination);
    if (target.status !== SwapStatus.ConfirmedDestination && !hasToasted.current) {
      hasToasted.current = true;
      toast.success('Swap complete! Funds have arrived.');
    }
  }, [isSwapTarget, solanaDestSwap.isDone, target, updateSwapTransactionStatus]);

  return null;
}
