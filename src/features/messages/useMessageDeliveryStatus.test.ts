import { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import type { RouteResponse } from '../api/types';
import type { MessageStubEntry } from './queries/fragments';
import { recoverMessageIds } from './useMessageDeliveryStatus';

const multiProvider = new MultiProtocolProvider({
  base: {
    name: 'base',
    chainId: 8453,
    domainId: 8453,
    protocol: ProtocolType.Ethereum,
    rpcUrls: [{ http: 'http://localhost' }],
  },
  solana: {
    name: 'solana',
    chainId: 1399811149,
    domainId: 1399811149,
    protocol: ProtocolType.Sealevel,
    rpcUrls: [{ http: 'http://localhost' }],
  },
});
const route = {
  callCommitment: { version: 1 },
  steps: [{ type: 'bridge', router: `0x${'99'.repeat(20)}`, destChain: 8453 }],
} as RouteResponse;
const rows: MessageStubEntry[] = ['ab'.repeat(64), '01abcdef', '02abcdef'].map((body, index) => ({
  msg_id: `\\x${String(index + 1).repeat(64)}`,
  message_body: `\\x${body}`,
  sender: `\\x${'11'.repeat(32)}`,
  recipient: `\\x${'22'.repeat(32)}`,
  origin_domain_id: 8453,
  destination_domain_id: 8453,
  origin_tx_hash: `\\x${'aa'.repeat(32)}`,
  destination_tx_hash: `\\x${'bb'.repeat(32)}`,
  origin_block_height: 100,
  destination_block_height: 200,
  send_occurred_at: '2026-11-04T10:00:00',
  is_delivered: true,
}));

describe('origin transaction message recovery', () => {
  test.each([[], [rows[0]], [rows[0], rows[1]], [rows[1], rows[2]], [rows[0], rows[2]]])(
    'keeps incomplete known EVM CCS dispatches in discovery: %j',
    (...entries) => {
      expect(recoverMessageIds(entries, route, multiProvider)).toBeUndefined();
    },
  );

  test('recovers the complete set for EVM and Solana origins', () => {
    for (const origin of [8453, 1399811149]) {
      expect(
        recoverMessageIds(
          rows.map((row) => ({ ...row, origin_domain_id: origin })),
          route,
          multiProvider,
        ),
      ).toEqual([
        { msgId: `0x${'1'.repeat(64)}`, label: 'bridge' },
        { msgId: `0x${'2'.repeat(64)}`, label: 'commit' },
        { msgId: `0x${'3'.repeat(64)}`, label: 'reveal' },
      ]);
    }
  });

  test('does not impose ICA message requirements on ordinary, unknown, or Solana routes', () => {
    const candidates = [
      undefined,
      { ...route, callCommitment: undefined },
      { ...route, steps: [] },
      ...[1399811149, 999].map((destChain) => ({
        ...route,
        steps: [{ ...route.steps[0], destChain }],
      })),
    ] as Array<RouteResponse | undefined>;
    for (const candidate of candidates) {
      expect(recoverMessageIds([rows[0]], candidate, multiProvider)).toEqual([
        { msgId: `0x${'1'.repeat(64)}`, label: 'bridge' },
      ]);
    }
    expect(recoverMessageIds(undefined, route, multiProvider)).toBeUndefined();
  });
});
