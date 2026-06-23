import { describe, expect, test } from 'vitest';

import { TransferStatus, type TransferHistoryItem } from '../transfer/engine/types';
import { shouldUpdateFromOriginTx } from './TransactionDeliveryWatcher';
import type { OriginTxMessagesResult } from './useOriginTxMessages';

const MSG_ID = `0x${'11'.repeat(32)}`;

describe('shouldUpdateFromOriginTx', () => {
  test('does not update when recovered origin tx data is already stored', () => {
    const origin = originTxMessages();
    const transfer = transferItem({
      status: TransferStatus.Bridging,
      msgIds: origin.msgIds,
      originBlockNumber: origin.originBlockHeight,
      originTxTimestamp: Math.floor(origin.originTimestamp! / 1000),
    });

    expect(shouldUpdateFromOriginTx(transfer, TransferStatus.Bridging, origin)).toBe(false);
  });

  test('updates once when recovered messages replace an empty message list', () => {
    const origin = originTxMessages();
    const transfer = transferItem({
      status: TransferStatus.Bridging,
      msgIds: [],
      originBlockNumber: 999,
      originTxTimestamp: 111,
    });

    expect(shouldUpdateFromOriginTx(transfer, TransferStatus.Bridging, origin)).toBe(true);
  });

  test('does not update again when only preserved origin metadata differs', () => {
    const origin = originTxMessages();
    const transfer = transferItem({
      status: TransferStatus.Bridging,
      msgIds: origin.msgIds,
      originBlockNumber: 999,
      originTxTimestamp: 111,
    });

    expect(shouldUpdateFromOriginTx(transfer, TransferStatus.Bridging, origin)).toBe(false);
  });

  test('updates when graphql later backfills the destination tx hash', () => {
    const origin = originTxMessages({ destinationTxHash: `0x${'22'.repeat(32)}` });
    const transfer = transferItem({
      status: TransferStatus.ConfirmedDestination,
      msgIds: origin.msgIds,
      originBlockNumber: origin.originBlockHeight,
      originTxTimestamp: Math.floor(origin.originTimestamp! / 1000),
    });

    expect(shouldUpdateFromOriginTx(transfer, TransferStatus.ConfirmedDestination, origin)).toBe(
      true,
    );
  });
});

function originTxMessages(overrides: Partial<OriginTxMessagesResult> = {}): OriginTxMessagesResult {
  return {
    msgIds: [{ msgId: MSG_ID, label: 'bridge' }],
    isDelivered: false,
    originTimestamp: 1_718_000_000_000,
    originBlockHeight: 123,
    isLoading: false,
    ...overrides,
  };
}

function transferItem(overrides: Partial<TransferHistoryItem>): TransferHistoryItem {
  return {
    status: TransferStatus.ConfirmingOrigin,
    timestamp: Date.now(),
    srcChain: 1634493807,
    dstChain: 8453,
    srcToken: 'credits',
    dstToken: '0x0000000000000000000000000000000000000001',
    amountIn: '1',
    amountOut: '1',
    sender: 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc',
    recipient: '0x0000000000000000000000000000000000000002',
    ...overrides,
  };
}
