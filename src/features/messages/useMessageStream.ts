import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { create } from 'zustand';

import { config } from '../../consts/config';
import { TransactionHistoryItemType, useStore } from '../store';
import { TransferStatus } from '../transfer/engine/types';
import { mailboxDeliveryQueryKey } from './mailboxDelivery';
import {
  connectMessageStream,
  LiveConnection,
  messageStreamUrl,
  normalizeMessageId,
  type MessageStreamState,
} from './messageStream';
import { txHashToPostgresBytea } from './queries/encoding';
import type { MessageStubEntry } from './queries/fragments';
import { getTransferDeliveryMsgId } from './utils';

export const useMessageStream = create<MessageStreamState>(() => ({
  connection: LiveConnection.Connecting,
  heads: {},
}));

export function useWatchMessages(domains: number[]) {
  const client = useQueryClient();
  useEffect(() => subscribeToMessageUpdates(client), [client]);

  const domainKey = [...new Set(domains.map((domain) => domain >>> 0))]
    .sort((a, b) => a - b)
    .join(',');
  useEffect(() => {
    if (!domainKey) {
      useMessageStream.setState({ connection: LiveConnection.Connecting, heads: {} });
      return;
    }
    const url = messageStreamUrl(
      config.explorerApiUrl,
      config.explorerWsUrl,
      domainKey.split(',').map(Number),
    );
    return connectMessageStream(url, client, useMessageStream.setState);
  }, [client, domainKey]);
}

/** Reconcile both streamed updates and reconnect snapshots with persisted outcomes. */
export function subscribeToMessageUpdates(client: QueryClient) {
  return client.getQueryCache().subscribe((event) => {
    if (
      event.type !== 'updated' ||
      event.action.type !== 'success' ||
      !['messageDelivery', 'mailboxDelivery'].includes(String(event.query.queryKey[0]))
    )
      return;
    const variables = event.query.queryKey[1];
    if (
      !variables ||
      typeof variables !== 'object' ||
      !('msgId' in variables) ||
      typeof variables.msgId !== 'string'
    )
      return;
    const messageId = normalizeMessageId(variables.msgId);
    const indexedUpdate = event.query.queryKey[0] === 'messageDelivery';
    const row = client.getQueryData<MessageStubEntry[]>([
      'messageDelivery',
      { msgId: `\\x${messageId}` },
    ])?.[0];
    const mailbox = indexedUpdate
      ? client
          .getQueriesData<{ isDelivered: boolean; destinationTxHash?: string }>({
            queryKey: mailboxDeliveryQueryKey(`0x${messageId}`),
          })
          .find(([, data]) => data?.isDelivered)?.[1]
      : client.getQueryData<{ isDelivered: boolean; destinationTxHash?: string }>(
          event.query.queryKey,
        );
    // Match the shared hook's precedence: indexed delivery, otherwise mailbox evidence.
    if (indexedUpdate && !row?.is_delivered && mailbox?.isDelivered) return;
    if (
      !indexedUpdate &&
      (!mailbox || (row?.is_delivered && (row.destination_tx_hash || !mailbox.isDelivered)))
    )
      return;
    const delivered = indexedUpdate ? row?.is_delivered : mailbox?.isDelivered;
    // Only the execution message owns the persisted outcome. Other messages may
    // still be catching up in the indexer after a successful reveal.
    const state = useStore.getState();
    let changed = false;
    const transactionHistory = state.transactionHistory.map((item) => {
      if (
        item.type !== TransactionHistoryItemType.Transfer ||
        normalizeMessageId(getTransferDeliveryMsgId(item.data.msgIds) ?? '') !== messageId ||
        (!item.data.destinationTxHash && item.data.status !== TransferStatus.ConfirmedDestination)
      )
        return item;
      if (delivered) {
        const metadata = state.multiProvider.tryGetChainMetadata(item.data.dstChain);
        const previousHash =
          item.data.destinationTxHash &&
          txHashToPostgresBytea(item.data.destinationTxHash, metadata);
        const destinationHash = indexedUpdate
          ? row?.destination_tx_hash
          : mailbox?.destinationTxHash
            ? txHashToPostgresBytea(mailbox.destinationTxHash, metadata)
            : undefined;
        // A reconnect can miss both rollback and redelivery. Even a delivered
        // snapshot must invalidate an outcome checked against a different tx.
        if (
          !previousHash ||
          !destinationHash ||
          normalizeMessageId(previousHash) === normalizeMessageId(destinationHash)
        )
          return item;
      }
      changed = true;
      return {
        ...item,
        data: { ...item.data, status: TransferStatus.Bridging, destinationTxHash: undefined },
      };
    });
    if (changed) useStore.setState({ transactionHistory });
  });
}
