import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { logger } from '../../utils/logger';
import { DiagnosticConnection } from './diagnostics';
import { connectDiagnostics } from './useMessageDiagnostics';

const id = `0x${'11'.repeat(32)}`;
const data = { version: 1, message_id: id, partial: false, activities: [] };
class Socket {
  static instances: Socket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn(() => this.onclose?.());
  constructor(readonly url: string) {
    Socket.instances.push(this);
  }
  send(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  Socket.instances = [];
  vi.stubGlobal('WebSocket', Socket);
});
afterEach(() => {
  stop?.();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('requests only one message and keeps the last tree through diagnostics outages', () => {
  const update = vi.fn();
  stop = connectDiagnostics([id], update);
  const socket = Socket.instances[0],
    url = new URL(socket.url);
  expect(url.searchParams.get('messageIds')).toBe(id.slice(2));
  expect(url.searchParams.get('diagnostics')).toBe('true');
  expect(url.searchParams.has('blocks')).toBe(false);
  socket.send({ type: 'ready' });
  expect(update).toHaveBeenLastCalledWith(id.slice(2), {
    connection: DiagnosticConnection.Connecting,
    data: undefined,
  });
  socket.send({ type: 'diagnostics', data });
  socket.send({ type: 'diagnostics_unavailable', message_ids: [id], message: 'Unavailable' });
  expect(update).toHaveBeenLastCalledWith(id.slice(2), {
    connection: DiagnosticConnection.Stale,
    data: { partial: false, relayers: [] },
  });
  expect(socket.close).not.toHaveBeenCalled();
  socket.send({ type: 'message_upsert', data: {} });
  socket.send({ type: 'diagnostics', data });
  expect(update).toHaveBeenLastCalledWith(id.slice(2), {
    connection: DiagnosticConnection.Live,
    data: { partial: false, relayers: [] },
  });
});

it('reconnects silent sockets, ignores late frames, and cleans up when the transfer closes or changes', async () => {
  const update = vi.fn();
  stop = connectDiagnostics([id], update);
  const old = Socket.instances[0];
  old.send({ type: 'diagnostics', data });
  await vi.advanceTimersByTimeAsync(66_000);
  expect(Socket.instances).toHaveLength(2);
  expect(update).toHaveBeenLastCalledWith(id.slice(2), {
    connection: DiagnosticConnection.Stale,
    data: { partial: false, relayers: [] },
  });
  const calls = update.mock.calls.length;
  old.send({ type: 'diagnostics', data });
  expect(update).toHaveBeenCalledTimes(calls);
  stop();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(Socket.instances).toHaveLength(2);
  expect(Socket.instances[1].close).toHaveBeenCalledOnce();
});

it('bounds the initial loading state even when heartbeats arrive without a snapshot', async () => {
  const update = vi.fn();
  stop = connectDiagnostics([id], update);
  const socket = Socket.instances[0];
  await vi.advanceTimersByTimeAsync(9_000);
  socket.send({ type: 'heartbeat' });
  await vi.advanceTimersByTimeAsync(1_000);
  expect(update).toHaveBeenLastCalledWith(id.slice(2), {
    connection: DiagnosticConnection.Stale,
    data: undefined,
  });
  expect(socket.close).not.toHaveBeenCalled();
  socket.send({ type: 'diagnostics', data });
  expect(update).toHaveBeenLastCalledWith(id.slice(2), {
    connection: DiagnosticConnection.Live,
    data: { partial: false, relayers: [] },
  });
});

it('cancels the loading deadline after a snapshot and on cleanup', async () => {
  const update = vi.fn();
  stop = connectDiagnostics([id], update);
  Socket.instances[0].send({ type: 'diagnostics', data });
  await vi.advanceTimersByTimeAsync(11_000);
  expect(update).toHaveBeenLastCalledWith(id.slice(2), {
    connection: DiagnosticConnection.Live,
    data: { partial: false, relayers: [] },
  });
  stop();
  update.mockClear();
  stop = connectDiagnostics([id], update);
  stop();
  update.mockClear();
  await vi.advanceTimersByTimeAsync(11_000);
  expect(update).not.toHaveBeenCalled();
});

it('shares one connection across three messages without mixing their snapshots or outages', () => {
  const second = `0x${'22'.repeat(32)}`;
  const third = `0x${'33'.repeat(32)}`;
  const update = vi.fn();
  stop = connectDiagnostics([third, id, second, id], update);
  expect(Socket.instances).toHaveLength(1);
  const socket = Socket.instances[0];
  expect(new URL(socket.url).searchParams.get('messageIds')).toBe(
    [id, second, third].map((v) => v.slice(2)).join(','),
  );
  update.mockClear();
  socket.send({ type: 'diagnostics', data: { ...data, message_id: second } });
  expect(update).toHaveBeenCalledExactlyOnceWith(second.slice(2), {
    connection: DiagnosticConnection.Live,
    data: { partial: false, relayers: [] },
  });
  update.mockClear();
  socket.send({ type: 'diagnostics_unavailable', message_ids: [id, third] });
  expect(update.mock.calls.map(([id]) => id)).toEqual([id, third].map((v) => v.slice(2)));
  expect(socket.close).not.toHaveBeenCalled();
  update.mockClear();
  socket.send({ type: 'diagnostics', data: { ...data, message_id: id } });
  expect(update).toHaveBeenCalledExactlyOnceWith(id.slice(2), {
    connection: DiagnosticConnection.Live,
    data: { partial: false, relayers: [] },
  });
  update.mockClear();
  socket.send({ type: 'diagnostics', data: { ...data, message_id: `0x${'44'.repeat(32)}` } });
  expect(update).not.toHaveBeenCalled();
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  socket.send({
    type: 'diagnostics',
    data: { ...data, message_id: second, activities: 'invalid' },
  });
  expect(update).toHaveBeenCalledExactlyOnceWith(second.slice(2), {
    connection: DiagnosticConnection.Stale,
    data: { partial: false, relayers: [] },
  });
});

it('times out only the messages still waiting for their initial snapshot', async () => {
  const second = `0x${'22'.repeat(32)}`;
  const update = vi.fn();
  stop = connectDiagnostics([id, second], update);
  Socket.instances[0].send({ type: 'diagnostics', data });
  update.mockClear();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(update).toHaveBeenCalledExactlyOnceWith(second.slice(2), {
    connection: DiagnosticConnection.Stale,
    data: undefined,
  });
});

it('opens no connection before message IDs are known', () => {
  const update = vi.fn();
  stop = connectDiagnostics([], update);
  expect(Socket.instances).toHaveLength(0);
  expect(update).not.toHaveBeenCalled();
});
