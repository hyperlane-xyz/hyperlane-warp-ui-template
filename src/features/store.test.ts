import { describe, expect, test } from 'vitest';

import { mergeTransferTransactionUpdate } from './store';
import { TransferStatus, type TransferHistoryItem } from './transfer/engine/types';

const MSG_ID = `0x${'11'.repeat(32)}`;
const DST_TX_HASH = `0x${'22'.repeat(32)}`;

describe('mergeTransferTransactionUpdate', () => {
  test('replaces empty message ids with recovered origin messages', () => {
    const data = transferItem({
      status: TransferStatus.Bridging,
      msgIds: [],
      originBlockNumber: 999,
      originTxTimestamp: 111,
    });
    const msgIds = [{ msgId: MSG_ID, label: 'bridge' as const }];

    const next = mergeTransferTransactionUpdate(data, TransferStatus.Bridging, {
      msgIds,
      originBlockNumber: 123,
      originTxTimestamp: 1_718_000_000,
    });

    expect(next).not.toBe(data);
    expect(next.msgIds).toBe(msgIds);
    expect(next.originBlockNumber).toBe(999);
    expect(next.originTxTimestamp).toBe(111);
  });

  test('returns same object for duplicate recovered origin data', () => {
    const msgIds = [{ msgId: MSG_ID, label: 'bridge' as const }];
    const data = transferItem({
      status: TransferStatus.Bridging,
      msgIds,
      originBlockNumber: 999,
      originTxTimestamp: 111,
    });

    expect(
      mergeTransferTransactionUpdate(data, TransferStatus.Bridging, {
        msgIds,
        originBlockNumber: 123,
        originTxTimestamp: 1_718_000_000,
      }),
    ).toBe(data);
  });

  test('backfills destination tx hash once', () => {
    const data = transferItem({ status: TransferStatus.ConfirmedDestination });

    const next = mergeTransferTransactionUpdate(data, TransferStatus.ConfirmedDestination, {
      destinationTxHash: DST_TX_HASH,
    });

    expect(next.destinationTxHash).toBe(DST_TX_HASH);
    expect(mergeTransferTransactionUpdate(next, TransferStatus.ConfirmedDestination, next)).toBe(
      next,
    );
  });
});

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
