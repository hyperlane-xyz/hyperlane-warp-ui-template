import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { create } from 'zustand';

import { config } from '../../consts/config';
import { TransactionHistoryItemType, useStore } from '../store';
import { TransferStatus } from '../transfer/engine/types';
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

export function useWatchMessages(domains: number[], messageIds: string[]) {
  const client = useQueryClient();
  useEffect(() => subscribeToMessageUpdates(client), [client]);

  const url = domains.length
    ? messageStreamUrl(config.explorerApiUrl, config.explorerWsUrl, domains, messageIds)
    : undefined;
  useEffect(() => {
    if (!url) {
      useMessageStream.setState({ connection: LiveConnection.Connecting, heads: {} });
      return;
    }
    return connectMessageStream(url, client, useMessageStream.setState);
  }, [client, url]);
}

/** Reconcile both streamed updates and reconnect snapshots with persisted outcomes. */
export function subscribeToMessageUpdates(client: QueryClient) {
  return client.getQueryCache().subscribe((event) => {
    if (
      event.type !== 'updated' ||
      event.action.type !== 'success' ||
      event.query.queryKey[0] !== 'messageDelivery'
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
    const row = client.getQueryData<MessageStubEntry[]>(event.query.queryKey)?.[0];
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
      if (row?.is_delivered) {
        const metadata = state.multiProvider.tryGetChainMetadata(item.data.dstChain);
        const previousHash =
          item.data.destinationTxHash &&
          txHashToPostgresBytea(item.data.destinationTxHash, metadata);
        const destinationHash = row.destination_tx_hash;
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
