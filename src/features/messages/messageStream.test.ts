import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  connectMessageStream,
  LiveConnection,
  messageStreamUrl,
  rollbackMessage,
} from './messageStream';
import { messageEntrySchema, type MessageStubEntry } from './queries/fragments';

const row: MessageStubEntry = {
  msg_id: `\\x${'11'.repeat(32)}`,
  sender: '0x01',
  recipient: '0x02',
  message_body: null,
  origin_domain_id: 8453,
  destination_domain_id: 56,
  origin_tx_hash: '\\xaa',
  destination_tx_hash: '\\xbb',
  origin_block_height: 100,
  destination_block_height: 200,
  send_occurred_at: '2026-11-04T10:00:00',
  is_delivered: true,
};
const key = ['messageDelivery', { msgId: `\\x${'11'.repeat(32)}` }];
class MockSocket {
  static instances: MockSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn(() => this.onclose?.());
  constructor(readonly url: string) {
    MockSocket.instances.push(this);
  }
  send(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}
const socket = () => MockSocket.instances[MockSocket.instances.length - 1];
let client: QueryClient;
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  MockSocket.instances = [];
  vi.stubGlobal('WebSocket', MockSocket);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  stop?.();
  client.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('live message status', () => {
  it('normalizes bigint block heights and rejects unsafe values', () => {
    expect(
      messageEntrySchema.parse({ ...row, origin_block_height: '100' }).origin_block_height,
    ).toBe(100);
    expect(
      messageEntrySchema.safeParse({ ...row, origin_block_height: '9007199254740993' }).success,
    ).toBe(false);
    expect(messageEntrySchema.safeParse({ ...row, origin_block_height: null }).success).toBe(true);
  });
  it('derives the subscription URL and respects an override', () => {
    expect(messageStreamUrl('https://example.com/graphql', undefined, [56, 8453])).toBe(
      'wss://example.com/messages?confirmations=0&domains=56%2C8453&blocks=true&messageIds=',
    );
    expect(
      messageStreamUrl('http://localhost/graphql', 'ws://localhost:8080/messages', [1]),
    ).toContain('ws://localhost:8080/messages?');
  });
  it('scopes messages to normalized IDs and uses an empty filter while discovering', () => {
    const first = 'AB'.repeat(32);
    const second = '12'.repeat(32);
    const url = new URL(
      messageStreamUrl(
        'https://example.com/graphql',
        undefined,
        [1],
        [`0x${first}`, `\\x${first.toLowerCase()}`, `0x${second}`],
      ),
    );
    expect(url.searchParams.get('messageIds')).toBe(`${second},${first.toLowerCase()}`);
    expect(
      new URL(messageStreamUrl('https://example.com/graphql', undefined, [1])).searchParams.get(
        'messageIds',
      ),
    ).toBe('');
  });
  it('keeps subscription URLs stable when tracked domains or messages reorder', () => {
    const a = `0x${'11'.repeat(32)}`;
    const b = `0x${'22'.repeat(32)}`;
    expect(
      messageStreamUrl('https://example.com/graphql', undefined, [8453, 56, 56], [b, a, a]),
    ).toBe(messageStreamUrl('https://example.com/graphql', undefined, [56, 8453], [a, b]));
  });
  it('applies push updates without polling and ignores unrelated messages', async () => {
    const fetch = vi.fn(async () => [{ ...row, is_delivered: false }]);
    const observer = new QueryObserver(client, { queryKey: key, queryFn: fetch });
    const unsubscribe = observer.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    stop = connectMessageStream('ws://test', client, vi.fn());
    socket().send({ type: 'ready' });
    await vi.advanceTimersByTimeAsync(0);
    const snapshots = fetch.mock.calls.length;
    socket().send({ type: 'message_upsert', data: row });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(client.getQueryData(key)).toEqual([row]);
    expect(fetch).toHaveBeenCalledTimes(snapshots);
    socket().send({ type: 'message_upsert', data: { ...row, msg_id: '\\x22' } });
    expect(client.getQueryCache().getAll()).toHaveLength(1);
    unsubscribe();
  });
  it('an older HTTP response cannot overwrite a pushed update', async () => {
    let resolveSnapshot: ((value: MessageStubEntry[]) => void) | undefined;
    const pending = client
      .fetchQuery({
        queryKey: key,
        queryFn: () =>
          new Promise<MessageStubEntry[]>((resolve) => {
            resolveSnapshot = resolve;
          }),
      })
      .catch(() => null);
    stop = connectMessageStream('ws://test', client, vi.fn());
    socket().send({ type: 'message_upsert', data: row });
    resolveSnapshot?.([{ ...row, is_delivered: false }]);
    await pending;
    expect(client.getQueryData(key)).toEqual([row]);
  });
  it('fetches the complete origin transaction batch on matching upserts', async () => {
    const fetch = vi.fn(async () => [row, { ...row, msg_id: '\\x22' }]);
    const observer = new QueryObserver(client, {
      queryKey: ['messageDelivery', { originTxHash: '\\xaa', originDomainId: 8453 }],
      queryFn: fetch,
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    stop = connectMessageStream('ws://test', client, vi.fn());
    socket().send({ type: 'message_upsert', data: row });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data).toHaveLength(2);
    unsubscribe();
  });
  it('reconnects and refreshes snapshots after a gap; cleans up timers', async () => {
    const fetch = vi.fn(async () => [row]);
    const observer = new QueryObserver(client, { queryKey: key, queryFn: fetch });
    const unsubscribe = observer.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    const update = vi.fn();
    stop = connectMessageStream('ws://test', client, update);
    socket().send({ type: 'ready' });
    await vi.advanceTimersByTimeAsync(0);
    socket().close();
    expect(update).toHaveBeenLastCalledWith({ connection: LiveConnection.Disconnected, heads: {} });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(MockSocket.instances).toHaveLength(2);
    socket().send({ type: 'ready' });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(70_000);
    expect(MockSocket.instances).toHaveLength(2);
    unsubscribe();
  });
  it('detects a silent connection and resumes after heartbeat timeout', async () => {
    stop = connectMessageStream('ws://test', client, vi.fn());
    socket().send({ type: 'ready' });
    await vi.advanceTimersByTimeAsync(60_000);
    socket().send({ type: 'heartbeat' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(MockSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(MockSocket.instances).toHaveLength(2);
  });
  it('retracts delivery and confirmation evidence on rollback', () => {
    client.setQueryData(key, [row]);
    client.setQueryData(['mailboxDelivery', { msgId: row.msg_id }], { isDelivered: true });
    client.setQueryData(['transactionConfirmations', 'bsc', 'hash'], { state: 'confirmed' });
    const update = vi.fn();
    stop = connectMessageStream('ws://test', client, update);
    socket().send({ type: 'block', domain: 56, headHeight: '210' });
    expect(update).toHaveBeenLastCalledWith({ heads: { 56: 210 } });
    socket().send({ type: 'rollback', domain: 56, toHeight: '199' });
    expect(client.getQueryData(['mailboxDelivery', { msgId: row.msg_id }])).toBeUndefined();
    expect(client.getQueryData(key)).toEqual([
      {
        ...row,
        is_delivered: false,
        destination_tx_hash: null,
        destination_block_height: null,
      },
    ]);
    expect(update).toHaveBeenLastCalledWith({ heads: { 56: 199 } });
    expect(client.getQueryData(['transactionConfirmations', 'bsc', 'hash'])).toBeUndefined();
    socket().send({ type: 'rollback', domain: 8453, toHeight: '99' });
    expect(client.getQueryData(key)).toEqual([]);
  });
  it('discards cached mailbox evidence on reconnect before repairing snapshots', () => {
    client.setQueryData(['mailboxDelivery', { msgId: row.msg_id }], { isDelivered: true });
    stop = connectMessageStream('ws://test', client, vi.fn());
    socket().send({ type: 'ready' });
    expect(client.getQueryData(['mailboxDelivery', { msgId: row.msg_id }])).toBeUndefined();
  });
  it('leaves unaffected transactions intact and conservatively retracts missing heights', () => {
    expect(rollbackMessage(row, 1, 0)).toBe(row);
    expect(rollbackMessage(row, 56, 200)).toBe(row);
    expect(rollbackMessage({ ...row, destination_block_height: null }, 56, 199)?.is_delivered).toBe(
      false,
    );
  });
  it('switches to reconnect recovery on malformed frames', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const update = vi.fn();
    stop = connectMessageStream('ws://test', client, update);
    socket().send({ type: 'message_upsert', data: { msg_id: 'invalid' } });
    expect(update).toHaveBeenLastCalledWith({ connection: LiveConnection.Disconnected, heads: {} });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(MockSocket.instances).toHaveLength(2);
    warn.mockRestore();
  });
});
