import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import type { RouteResponse } from '../api/types';
import type { MessageStubEntry } from './queries/fragments';
import {
  getOriginTxSwapMessagesRouteKey,
  parseOriginTxSwapMessages,
} from './useOriginTxSwapMessages';

const BRIDGE_ROUTER = '0x00000000000000000000000000000000000000aa';
const TX_HASH = `0x${'ee'.repeat(32)}`;

const multiProvider = {
  tryGetChainMetadata: () => ({ protocol: ProtocolType.Ethereum }),
} as unknown as MultiProtocolProvider;

function createRoute(): RouteResponse {
  return {
    tx: {
      to: '0x0000000000000000000000000000000000000001',
      data: '0x',
      value: '0',
    },
    output: '1',
    outputMin: '1',
    connection: null,
    gas: { originGas: '0', destGas: '0' },
    steps: [
      {
        type: 'bridge',
        chain: 1,
        destChain: 2,
        asset: '0x0000000000000000000000000000000000000002',
        router: BRIDGE_ROUTER,
        amountIn: '1',
        amountOut: '1',
        fee: {
          tokenFee: '0',
          igpToken: '0x0000000000000000000000000000000000000000',
          igpAmount: '0',
        },
      },
    ],
  };
}

function message(overrides: Partial<MessageStubEntry>): MessageStubEntry {
  return {
    id: 1,
    msg_id: bytea('11'),
    nonce: 1,
    sender: bytea('00'),
    recipient: bytea('00'),
    is_delivered: false,
    send_occurred_at: '2026-06-26T00:00:00',
    delivery_occurred_at: null,
    origin_chain_id: 1,
    origin_domain_id: 1,
    origin_tx_hash: bytea('aa'),
    origin_tx_sender: bytea('00'),
    origin_tx_recipient: bytea('00'),
    destination_chain_id: 2,
    destination_domain_id: 2,
    destination_tx_hash: null,
    destination_tx_sender: null,
    destination_tx_recipient: null,
    message_body: null,
    origin_block_height: 123,
    ...overrides,
  };
}

describe('parseOriginTxSwapMessages', () => {
  test('keys recovered-label queries by bridge route routers', () => {
    expect(getOriginTxSwapMessagesRouteKey(undefined)).toBe('none');
    expect(getOriginTxSwapMessagesRouteKey(createRoute())).toBe(`1-2-${BRIDGE_ROUTER}`);
  });

  test('recovers route-aware warp, commit, and reveal labels from origin tx messages', () => {
    const parsed = parseOriginTxSwapMessages(
      [
        message({
          id: 1,
          msg_id: bytea('11'),
          sender: paddedAddress(BRIDGE_ROUTER),
          message_body: bytea('99'),
        }),
        message({
          id: 2,
          msg_id: bytea('22'),
          sender: paddedAddress('0x00000000000000000000000000000000000000bb'),
          message_body: bytea('01'),
        }),
        message({
          id: 3,
          msg_id: bytea('33'),
          sender: paddedAddress('0x00000000000000000000000000000000000000bb'),
          message_body: bytea('02'),
          is_delivered: true,
          destination_tx_hash: `\\x${TX_HASH.slice(2)}`,
        }),
      ],
      createRoute(),
      multiProvider,
    );

    expect(parsed.msgIds).toEqual([
      { msgId: `0x${'11'.repeat(32)}`, label: 'warp' },
      { msgId: `0x${'22'.repeat(32)}`, label: 'commit' },
      { msgId: `0x${'33'.repeat(32)}`, label: 'reveal' },
    ]);
    expect(parsed.isDelivered).toBe(true);
    expect(parsed.destinationTxHash).toBe(TX_HASH);
    expect(parsed.originBlockHeight).toBe(123);
  });

  test('labels single recovered messages as warp without an in-memory route', () => {
    const parsed = parseOriginTxSwapMessages(
      [
        message({
          msg_id: bytea('44'),
          is_delivered: true,
          destination_tx_hash: `\\x${TX_HASH.slice(2)}`,
        }),
      ],
      undefined,
      multiProvider,
    );

    expect(parsed.msgIds).toEqual([{ msgId: `0x${'44'.repeat(32)}`, label: 'warp' }]);
    expect(parsed.destinationTxHash).toBe(TX_HASH);
  });
});

function bytea(byte: string) {
  return `\\x${byte.repeat(32)}`;
}

function paddedAddress(address: string) {
  return `\\x${'00'.repeat(12)}${address.slice(2).toLowerCase()}`;
}
