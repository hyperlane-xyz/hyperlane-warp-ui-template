import { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { bufferToBase58, ProtocolType } from '@hyperlane-xyz/utils';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { TransactionHistoryItemType, useStore } from '../store';
import { TransferStatus } from '../transfer/engine/types';
import { stringToPostgresBytea } from './queries/encoding';
import type { MessageStubEntry } from './queries/fragments';
import { reconcileMessageRollback, subscribeToMessageUpdates } from './useMessageStream';

const msgId = `0x${'11'.repeat(32)}`;
const bridgeId = `0x${'22'.repeat(32)}`;
const oldHash = `0x${'aa'.repeat(32)}`;
const newHash = `0x${'bb'.repeat(32)}`;
const key = ['messageDelivery', { msgId: stringToPostgresBytea(msgId) }];
const row: MessageStubEntry = {
  msg_id: stringToPostgresBytea(msgId),
  sender: oldHash,
  recipient: oldHash,
  message_body: null,
  origin_domain_id: 8453,
  destination_domain_id: 56,
  origin_tx_hash: oldHash,
  destination_tx_hash: stringToPostgresBytea(newHash),
  is_delivered: true,
  send_occurred_at: '2026-11-04T10:00:00',
};
const originalState = useStore.getState();
let client: QueryClient;
let unsubscribe: () => void;
beforeEach(() => {
  client = new QueryClient();
  useStore.setState({
    multiProvider: new MultiProtocolProvider({
      bsc: {
        name: 'bsc',
        chainId: 56,
        domainId: 56,
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
    }),
    transactionHistory: [
      {
        id: 'transfer',
        type: TransactionHistoryItemType.Transfer,
        data: {
          status: TransferStatus.ConfirmedDestination,
          timestamp: 1,
          srcChain: 8453,
          dstChain: 56,
          srcToken: 'src',
          dstToken: 'dst',
          amountIn: '1',
          amountOut: '1',
          sender: 'sender',
          recipient: 'recipient',
          msgIds: [
            { msgId: bridgeId, label: 'bridge' },
            { msgId, label: 'reveal' },
          ],
          destinationTxHash: oldHash,
          destinationOutcome: { bridgeToken: 'bridge', dstToken: 'dst' },
        },
      },
    ],
  });
  unsubscribe = subscribeToMessageUpdates(client);
});
afterEach(() => {
  unsubscribe?.();
  client.clear();
  useStore.setState(originalState);
});
const transfer = () => useStore.getState().transactionHistory[0].data;

describe('persisted delivery reconciliation', () => {
  test.each([
    TransferStatus.ConfirmedDestination,
    TransferStatus.FailedRecovered,
    TransferStatus.DestFailed,
  ])('rechecks %s when reconnect skips rollback and sees a replacement delivery', (status) => {
    useStore.getState().updateTransferTransactionStatus('transfer', status);
    const outcome = transfer().destinationOutcome;
    client.setQueryData(key, [row]);
    expect(transfer().status).toBe(TransferStatus.Bridging);
    expect(transfer().destinationTxHash).toBeUndefined();
    expect(transfer().destinationOutcome).toEqual(outcome);
    useStore
      .getState()
      .updateTransferTransactionStatus('transfer', TransferStatus.ConfirmingDestination, {
        destinationTxHash: newHash,
      });
    expect(transfer().destinationTxHash).toBe(newHash);
  });

  test('unchanged delivery preserves the checked outcome and history reference', () => {
    const history = useStore.getState().transactionHistory;
    client.setQueryData(key, [{ ...row, destination_tx_hash: `0x${'AA'.repeat(32)}` }]);
    expect(useStore.getState().transactionHistory).toBe(history);
  });

  test('compares Solana signatures as bytes instead of lowercasing base58', () => {
    const signature = bufferToBase58(Buffer.from('ab'.repeat(64), 'hex'));
    useStore.setState({
      transactionHistory: [
        {
          ...useStore.getState().transactionHistory[0],
          data: { ...transfer(), dstChain: 1399811149, destinationTxHash: signature },
        },
      ],
    });
    client.setQueryData(key, [{ ...row, destination_tx_hash: `\\x${'ab'.repeat(64)}` }]);
    expect(transfer().destinationTxHash).toBe(signature);
    client.setQueryData(key, [{ ...row, destination_tx_hash: `\\x${'cd'.repeat(64)}` }]);
    expect(transfer().status).toBe(TransferStatus.Bridging);
    expect(transfer().destinationTxHash).toBeUndefined();
  });

  test.each([{ rows: [] }, { rows: [{ ...row, is_delivered: false, destination_tx_hash: null }] }])(
    'preserves outcomes when an index snapshot lacks delivery evidence: %j',
    ({ rows }) => {
      const history = useStore.getState().transactionHistory;
      client.setQueryData(key, rows);
      expect(useStore.getState().transactionHistory).toBe(history);
      expect(transfer().status).toBe(TransferStatus.ConfirmedDestination);
      expect(transfer().destinationTxHash).toBe(oldHash);
    },
  );

  test('explicit destination rollback retracts the persisted outcome', () => {
    reconcileMessageRollback(row, {
      ...row,
      is_delivered: false,
      destination_tx_hash: null,
    });
    expect(transfer().status).toBe(TransferStatus.Bridging);
    expect(transfer().destinationTxHash).toBeUndefined();
  });

  test('explicit origin rollback clears stale dispatch evidence', () => {
    reconcileMessageRollback(row, null);
    expect(transfer().status).toBe(TransferStatus.ConfirmingOrigin);
    expect(transfer().msgIds).toBeUndefined();
    expect(transfer().destinationTxHash).toBeUndefined();
  });

  test('pending bridge/commit indexing does not retract a checked reveal outcome', () => {
    client.setQueryData(['messageDelivery', { msgId: stringToPostgresBytea(bridgeId) }], []);
    expect(transfer().status).toBe(TransferStatus.ConfirmedDestination);
  });
});
