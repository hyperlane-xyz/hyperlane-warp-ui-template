import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { z } from 'zod';

import { logger } from '../../utils/logger';
import { blockHeightSchema, messageEntrySchema, type MessageStubEntry } from './queries/fragments';

export enum LiveConnection {
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnected = 'disconnected',
}
export interface MessageStreamState {
  connection: LiveConnection;
  heads: Record<number, number>;
}
const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('heartbeat') }),
  z.object({ type: z.literal('error'), error: z.string() }),
  z.object({ type: z.literal('message_upsert'), data: messageEntrySchema }),
  z.object({ type: z.literal('block'), domain: z.number().int(), headHeight: blockHeightSchema }),
  z.object({ type: z.literal('rollback'), domain: z.number().int(), toHeight: blockHeightSchema }),
]);

export function messageStreamUrl(apiUrl: string, override: string | undefined, domains: number[]) {
  const url = new URL(override || '/messages', apiUrl);
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.searchParams.set('confirmations', '0');
  url.searchParams.set('domains', domains.join(','));
  url.searchParams.set('blocks', 'true');
  return url.toString();
}
export function normalizeMessageId(value: string) {
  return value.replace(/^(?:0x|\\x)/, '').toLowerCase();
}

/** Retract provisional evidence immediately, before requesting a fresh snapshot. */
export function rollbackMessage(
  row: MessageStubEntry,
  domain: number,
  height: number,
): MessageStubEntry | null {
  if (
    row.origin_domain_id === domain &&
    (row.origin_block_height == null || row.origin_block_height > height)
  )
    return null;
  if (
    row.destination_domain_id !== domain ||
    !row.is_delivered ||
    (row.destination_block_height != null && row.destination_block_height <= height)
  )
    return row;
  return { ...row, is_delivered: false, destination_tx_hash: null, destination_block_height: null };
}

/** One live-only stream per application. GraphQL repairs gaps on every ready frame. */
export function connectMessageStream(
  url: string,
  client: QueryClient,
  update: (state: Partial<MessageStreamState>) => void,
) {
  let socket: WebSocket | undefined;
  let stopped = false;
  let retryDelay = 1_000;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  let heads: Record<number, number> = {};
  const refresh = (queryKey: QueryKey = ['messageDelivery']) => {
    // Cancel older snapshots before a live update or a fresh snapshot can replace them.
    void client.cancelQueries({ queryKey });
    void client.invalidateQueries({ queryKey });
  };
  const reconnect = () => {
    if (stopped || retryTimer) return;
    const old = socket;
    socket = undefined;
    old?.close();
    clearTimeout(heartbeatTimer);
    heads = {};
    update({ connection: LiveConnection.Disconnected, heads });
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10_000);
  };
  const watchHeartbeat = () => {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(reconnect, 65_000);
  };
  const connect = () => {
    if (stopped) return;
    let current: WebSocket;
    try {
      current = new WebSocket(url);
    } catch (error) {
      logger.warn('Could not connect to live message status', error);
      reconnect();
      return;
    }
    socket = current;
    watchHeartbeat();
    current.onmessage = ({ data }) => {
      if (socket !== current) return;
      try {
        const event = eventSchema.parse(JSON.parse(data));
        watchHeartbeat();
        switch (event.type) {
          case 'ready':
            retryDelay = 1_000;
            update({ connection: LiveConnection.Connected });
            refresh();
            break;
          case 'block':
            heads = { ...heads, [event.domain >>> 0]: event.headHeight };
            update({ heads });
            break;
          case 'message_upsert': {
            const row = event.data;
            const queryKey = ['messageDelivery', { msgId: `\\x${normalizeMessageId(row.msg_id)}` }];
            void client.cancelQueries({ queryKey });
            client.setQueriesData<MessageStubEntry[]>({ queryKey }, [row]);
            // Recover the full dispatch batch, not just its first CCS message.
            refresh([
              'messageDelivery',
              {
                originTxHash: `\\x${normalizeMessageId(row.origin_tx_hash)}`,
                originDomainId: row.origin_domain_id,
              },
            ]);
            break;
          }
          case 'rollback': {
            const domain = event.domain >>> 0;
            heads = { ...heads, [domain]: event.toHeight };
            update({ heads });
            void client.cancelQueries({ queryKey: ['messageDelivery'] });
            client.setQueriesData<MessageStubEntry[]>({ queryKey: ['messageDelivery'] }, (rows) =>
              rows?.flatMap((row) => {
                const next = rollbackMessage(row, domain, event.toHeight);
                return next ? [next] : [];
              }),
            );
            void client.resetQueries({ queryKey: ['transactionConfirmations'] });
            refresh();
            break;
          }
          case 'error':
            throw new Error(event.error);
        }
      } catch (error) {
        logger.warn('Live message status interrupted; reconnecting', error);
        reconnect();
      }
    };
    current.onerror = () => {
      if (socket !== current) return;
      logger.warn('Live message websocket failed; using status polling until reconnected');
      reconnect();
    };
    current.onclose = () => {
      if (socket === current) reconnect();
    };
  };
  update({ connection: LiveConnection.Connecting, heads });
  connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    clearTimeout(heartbeatTimer);
    socket?.close();
    socket = undefined;
  };
}
