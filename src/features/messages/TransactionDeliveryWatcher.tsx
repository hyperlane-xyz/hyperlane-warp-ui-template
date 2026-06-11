import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  decodeFunctionResult,
  encodeFunctionData,
  parseAbi,
  toEventSelector,
  type Hex,
} from 'viem';

import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import { FinalSwapStatuses, SwapStatus, type LabeledMsgId } from '../swap/types';
import { TransferStatus } from '../transfer/types';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';

const MAILBOX_DELIVERY_POLL_INTERVAL_MS = 3_000;
const MAILBOX_ABI = parseAbi([
  // Mirrors the stable Hyperlane Mailbox delivery surface used by the SDK.
  'function delivered(bytes32) view returns (bool)',
  'function processedAt(bytes32) view returns (uint256)',
  'event ProcessId(bytes32 indexed messageId)',
]);
const MAILBOX_PROCESS_ID_TOPIC = toEventSelector('ProcessId(bytes32)');

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

type EthersLikeProvider = {
  call: (tx: { to: string; data: string }) => Promise<string>;
  getLogs: (filter: {
    address: string;
    fromBlock: number;
    toBlock: number;
    topics: string[];
  }) => Promise<Array<{ transactionHash?: string }>>;
};

export function TransactionDeliveryWatcher() {
  const multiProvider = useMultiProvider();
  const chainAddresses = useStore((s) => s.chainAddresses);
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

        if (!item.data.msgIds?.length) return [];
        if (FinalSwapStatuses.includes(item.data.status) && item.data.destinationTxHash) return [];

        const destinationChain = multiProvider.tryGetChainName(item.data.dstChain);
        if (!destinationChain) return [];
        const msgId = getSwapDeliveryMsgId(item.data.msgIds);
        return msgId
          ? [{ id: item.id, type: item.type, msgId, destinationChain, status: item.data.status }]
          : [];
      }),
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

function useEvmMailboxDeliveryStatus({
  msgId,
  destinationChain,
  chainAddresses,
  multiProvider,
  enabled,
}: {
  msgId: string;
  destinationChain: ChainName | undefined;
  chainAddresses: ChainMap<ChainAddresses>;
  multiProvider: MultiProtocolProvider;
  enabled: boolean;
}) {
  const { data } = useQuery({
    queryKey: ['evmMailboxDelivery', destinationChain, msgId],
    queryFn: async () => {
      if (!destinationChain) return { isDelivered: false, destinationTxHash: undefined };
      return getMailboxDeliveryStatus({ msgId, destinationChain, chainAddresses, multiProvider });
    },
    enabled: enabled && !!destinationChain,
    refetchInterval: (query) => {
      if (query.state.data?.isDelivered) return false;
      return MAILBOX_DELIVERY_POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });

  return {
    isDelivered: data?.isDelivered ?? false,
    destinationTxHash: data?.destinationTxHash,
  };
}

async function getMailboxDeliveryStatus({
  msgId,
  destinationChain,
  chainAddresses,
  multiProvider,
}: {
  msgId: string;
  destinationChain: ChainName;
  chainAddresses: ChainMap<ChainAddresses>;
  multiProvider: MultiProtocolProvider;
}) {
  try {
    const protocol = multiProvider.tryGetProtocol(destinationChain);
    if (protocol !== ProtocolType.Ethereum && protocol !== ProtocolType.Tron) {
      return { isDelivered: false, destinationTxHash: undefined };
    }

    const mailbox = chainAddresses[destinationChain]?.mailbox;
    if (!mailbox) return { isDelivered: false, destinationTxHash: undefined };

    const typedProvider = multiProvider.getProvider(destinationChain);
    if (typedProvider.type !== 'ethers-v5' && typedProvider.type !== 'tron') {
      return { isDelivered: false, destinationTxHash: undefined };
    }
    const provider = typedProvider.provider as EthersLikeProvider;
    const delivered = await callMailboxBoolean(provider, mailbox, 'delivered', msgId);
    if (!delivered) return { isDelivered: false, destinationTxHash: undefined };

    let destinationTxHash: string | undefined;
    try {
      const processedAt = await callMailboxUint(provider, mailbox, 'processedAt', msgId);
      destinationTxHash =
        processedAt > 0n
          ? await findProcessTxHash(provider, mailbox, msgId, Number(processedAt))
          : undefined;
    } catch (err) {
      logger.warn('Mailbox delivered but process transaction lookup failed', err as Error);
    }

    return { isDelivered: true, destinationTxHash };
  } catch (err) {
    logger.warn('Fast mailbox delivery check failed', err as Error);
    return { isDelivered: false, destinationTxHash: undefined };
  }
}

async function callMailboxBoolean(
  provider: EthersLikeProvider,
  mailbox: string,
  functionName: 'delivered',
  msgId: string,
) {
  const raw = await provider.call({
    to: mailbox,
    data: encodeMailboxCall(functionName, msgId),
  });
  return decodeFunctionResult({
    abi: MAILBOX_ABI,
    functionName,
    data: raw as Hex,
  });
}

async function callMailboxUint(
  provider: EthersLikeProvider,
  mailbox: string,
  functionName: 'processedAt',
  msgId: string,
) {
  const raw = await provider.call({
    to: mailbox,
    data: encodeMailboxCall(functionName, msgId),
  });
  return decodeFunctionResult({
    abi: MAILBOX_ABI,
    functionName,
    data: raw as Hex,
  });
}

async function findProcessTxHash(
  provider: EthersLikeProvider,
  mailbox: string,
  msgId: string,
  blockNumber: number,
) {
  const [log] = await provider.getLogs({
    address: mailbox,
    fromBlock: blockNumber,
    toBlock: blockNumber,
    topics: [MAILBOX_PROCESS_ID_TOPIC, msgId],
  });
  return log?.transactionHash;
}

function encodeMailboxCall(functionName: 'delivered' | 'processedAt', msgId: string) {
  return encodeFunctionData({
    abi: MAILBOX_ABI,
    functionName,
    args: [msgId as Hex],
  });
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
