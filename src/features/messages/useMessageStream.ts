import { useQueryClient } from '@tanstack/react-query';
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
import type { MessageStubEntry } from './queries/fragments';

export const useMessageStream = create<MessageStreamState>(() => ({
  connection: LiveConnection.Connecting,
  heads: {},
}));

export function useWatchMessages(domains: number[]) {
  const client = useQueryClient();
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
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
        const rows = client.getQueryData<MessageStubEntry[]>(event.query.queryKey);
        if (!rows || rows[0]?.is_delivered) return;
        // A rollback or reconnect snapshot can retract previously observed delivery.
        // Clear the persisted hash too, so a replacement transaction is checked afresh.
        const state = useStore.getState();
        let changed = false;
        const transactionHistory = state.transactionHistory.map((item) => {
          if (
            item.type !== TransactionHistoryItemType.Transfer ||
            !item.data.msgIds?.some(({ msgId }) => normalizeMessageId(msgId) === messageId) ||
            (!item.data.destinationTxHash &&
              item.data.status !== TransferStatus.ConfirmedDestination)
          )
            return item;
          changed = true;
          return {
            ...item,
            data: { ...item.data, status: TransferStatus.Bridging, destinationTxHash: undefined },
          };
        });
        if (changed) useStore.setState({ transactionHistory });
      }),
    [client],
  );

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
