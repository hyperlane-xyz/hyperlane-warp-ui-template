import { describe, expect, test } from 'vitest';

import {
  migratePersistedAppState,
  TransactionHistoryItemType,
  type TransactionHistoryItem,
} from './store';
import { SwapStatus, type SwapHistoryItem } from './swap/types';
import { TransferStatus, type TransferContext } from './transfer/types';

const ADDRESS = '0x1111111111111111111111111111111111111111';

function createBridgeTransfer(overrides: Partial<TransferContext> = {}): TransferContext {
  return {
    status: TransferStatus.Delivered,
    origin: 'ethereum',
    destination: 'base',
    amount: '1',
    sender: ADDRESS,
    recipient: ADDRESS,
    timestamp: 1_000,
    ...overrides,
  };
}

function createSwapTransfer(overrides: Partial<SwapHistoryItem> = {}): SwapHistoryItem {
  return {
    status: SwapStatus.ConfirmedDestination,
    timestamp: 2_000,
    srcChain: 1,
    dstChain: 8453,
    srcToken: '0x2222222222222222222222222222222222222222',
    dstToken: '0x3333333333333333333333333333333333333333',
    amountIn: '100',
    amountOut: '99',
    sender: ADDRESS,
    recipient: ADDRESS,
    ...overrides,
  };
}

describe('migratePersistedAppState', () => {
  test('keeps existing unified transaction history unchanged', () => {
    const transactionHistory: TransactionHistoryItem[] = [
      {
        id: 'bridge-1000-existing',
        type: TransactionHistoryItemType.Bridge,
        data: createBridgeTransfer(),
      },
      {
        id: 'swap-2000-existing',
        type: TransactionHistoryItemType.Swap,
        data: createSwapTransfer(),
      },
    ];

    expect(
      migratePersistedAppState({
        chainMetadataOverrides: { ethereum: { displayName: 'Ethereum Custom' } },
        transactionHistory,
      }),
    ).toEqual({
      chainMetadataOverrides: { ethereum: { displayName: 'Ethereum Custom' } },
      transactionHistory,
    });
  });

  test('migrates legacy split bridge and swap history into one typed array', () => {
    const bridge = createBridgeTransfer({ timestamp: 3_000 });
    const swap = createSwapTransfer({ timestamp: 4_000 });

    const migrated = migratePersistedAppState({
      transfers: [bridge],
      swaps: [swap],
    });

    expect(migrated.chainMetadataOverrides).toEqual({});
    expect(migrated.transactionHistory).toHaveLength(2);
    expect(migrated.transactionHistory[0]).toMatchObject({
      type: TransactionHistoryItemType.Bridge,
      data: bridge,
    });
    expect(migrated.transactionHistory[0].id).toMatch(/^bridge-3000-/);
    expect(migrated.transactionHistory[1]).toMatchObject({
      type: TransactionHistoryItemType.Swap,
      data: swap,
    });
    expect(migrated.transactionHistory[1].id).toMatch(/^swap-4000-/);
  });

  test('ignores malformed legacy history collections', () => {
    expect(
      migratePersistedAppState({
        transfers: { bad: true },
        swaps: null,
      }),
    ).toEqual({
      chainMetadataOverrides: {},
      transactionHistory: [],
    });
  });
});
