import { useEffect, useState } from 'react';
import { z } from 'zod';

import { config } from '../../consts/config';
import { logger } from '../../utils/logger';
import {
  DiagnosticConnection,
  readDiagnostics,
  reconcileDiagnostics,
  type MessageDiagnostics,
} from './diagnostics';
import { normalizeMessageId } from './messageStream';

export interface DiagnosticsState {
  connection: DiagnosticConnection;
  data?: MessageDiagnostics;
}
export const connectingDiagnostics: DiagnosticsState = {
  connection: DiagnosticConnection.Connecting,
};
const frameSchema = z.object({
  type: z.string(),
  data: z.unknown().optional(),
  message_ids: z.array(z.string()).optional(),
});
const envelopeIdSchema = z.object({ message_id: z.string() });

/** One socket for the selected transfer, with independent snapshots per message. */
export function connectDiagnostics(
  messageIds: string[],
  update: (messageId: string, state: DiagnosticsState) => void,
) {
  const ids = [...new Set(messageIds.map(normalizeMessageId))].sort();
  if (!ids.length) return () => {};
  const url = new URL(config.explorerWsUrl ?? '/messages', config.explorerApiUrl);
  url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'wss:' : 'ws:';
  url.search = new URLSearchParams({ diagnostics: 'true', messageIds: ids.join(',') }).toString();
  let stopped = false;
  let socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setTimeout> | undefined;
  let initialSnapshot: ReturnType<typeof setTimeout> | undefined;
  let delay = 1_000;
  const data = new Map<string, MessageDiagnostics>();
  const pending = new Set<string>();
  const publish = (connection: DiagnosticConnection, targets = ids) => {
    for (const id of targets) update(id, { connection, data: data.get(id) });
  };
  const received = (id: string) => {
    pending.delete(id);
    if (!pending.size) clearTimeout(initialSnapshot);
  };
  const reconnect = () => {
    if (stopped || retry) return;
    const previous = socket;
    socket = undefined;
    previous?.close();
    clearTimeout(heartbeat);
    clearTimeout(initialSnapshot);
    publish(DiagnosticConnection.Stale);
    retry = setTimeout(() => {
      retry = undefined;
      connect();
    }, delay);
    delay = Math.min(delay * 2, 30_000);
  };
  const watchHeartbeat = () => {
    clearTimeout(heartbeat);
    heartbeat = setTimeout(reconnect, 65_000);
  };
  const connect = () => {
    if (stopped) return;
    let current: WebSocket;
    try {
      current = new WebSocket(url.toString());
    } catch (error) {
      logger.warn('Could not connect to relay diagnostics', error);
      reconnect();
      return;
    }
    socket = current;
    pending.clear();
    for (const id of ids) pending.add(id);
    watchHeartbeat();
    // A snapshot for one message must not mask another message's loading timeout.
    initialSnapshot = setTimeout(() => publish(DiagnosticConnection.Stale, [...pending]), 10_000);
    current.onmessage = ({ data: value }) => {
      if (socket !== current) return;
      let messageId: string | undefined;
      try {
        const frame = frameSchema.parse(JSON.parse(value));
        watchHeartbeat();
        if (frame.type === 'diagnostics') {
          const id = normalizeMessageId(envelopeIdSchema.parse(frame.data).message_id);
          if (!ids.includes(id)) return;
          messageId = id;
          data.set(id, readDiagnostics(frame.data, id));
          received(id);
          delay = 1_000;
          publish(DiagnosticConnection.Live, [id]);
        } else if (frame.type === 'diagnostics_unavailable') {
          const affected = frame.message_ids
            ? [...new Set(frame.message_ids.map(normalizeMessageId))].filter((id) =>
                ids.includes(id),
              )
            : ids;
          for (const id of affected) received(id);
          // The server retries these messages without interrupting the others.
          publish(DiagnosticConnection.Stale, affected);
        } else if (frame.type === 'error') reconnect();
      } catch (error) {
        logger.warn('Could not read relay diagnostics', error);
        publish(DiagnosticConnection.Stale, messageId ? [messageId] : ids);
      }
    };
    current.onerror = () => {
      if (socket === current) reconnect();
    };
    current.onclose = () => {
      if (socket === current) reconnect();
    };
  };
  publish(DiagnosticConnection.Connecting);
  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearTimeout(heartbeat);
    clearTimeout(initialSnapshot);
    const previous = socket;
    socket = undefined;
    previous?.close();
  };
}

export function useMessageDiagnostics(messageIds: string[], enabled: boolean) {
  const key = [...new Set(messageIds.map(normalizeMessageId))].sort().join(',');
  const [states, setStates] = useState<Record<string, DiagnosticsState>>({});
  useEffect(() => {
    if (!enabled || !key) return;
    const ids = key.split(',');
    setStates((previous) =>
      Object.fromEntries(ids.map((id) => [id, previous[id] ?? connectingDiagnostics])),
    );
    return connectDiagnostics(ids, (id, next) =>
      setStates((previous) => ({
        ...previous,
        [id]: {
          ...next,
          data: next.data
            ? reconcileDiagnostics(previous[id]?.data, next.data)
            : previous[id]?.data,
        },
      })),
    );
  }, [key, enabled]);
  return states;
}
