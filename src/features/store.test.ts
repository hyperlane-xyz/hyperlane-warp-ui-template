import { afterEach, describe, expect, test } from 'vitest';

import {
  migratePersistedAppState,
  TransactionHistoryItemType,
  useStore,
  type TransactionHistoryItem,
} from './store';
import type { UiToken } from './swap/tokens/types';
import { getTokenKey as getSwapTokenKey } from './swap/tokens/utils';
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

function createUiToken(overrides: Partial<UiToken> = {}): UiToken {
  return {
    chainId: 1,
    address: '0x1111111111111111111111111111111111111111',
    symbol: 'SRC',
    decimals: 18,
    isNative: false,
    isBridgeToken: false,
    isPoolToken: true,
    canBridge: false,
    canSwap: true,
    bridgeSymbols: [],
    warpRouteIds: [],
    chainName: 'ethereum',
    name: 'Source Token',
    addressOrDenom: '0x1111111111111111111111111111111111111111',
    ...overrides,
  };
}

afterEach(() => {
  useStore.setState({ knownTokens: new Map() });
});

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

describe('syncTokens', () => {
  test('refreshes existing engine token metadata', () => {
    const stale = createUiToken({ coinGeckoId: undefined, logoURI: undefined });
    const fresh = createUiToken({
      coinGeckoId: 'source-token',
      logoURI: 'https://example.com/src.png',
    });

    useStore.getState().syncTokens([stale]);
    useStore.getState().syncTokens([fresh]);

    expect(useStore.getState().knownTokens.get(getSwapTokenKey(fresh))).toMatchObject({
      coinGeckoId: 'source-token',
      logoURI: 'https://example.com/src.png',
    });
  });

  test('keeps known token map stable when metadata is unchanged', () => {
    const token = createUiToken();

    useStore.getState().syncTokens([token]);
    const before = useStore.getState().knownTokens;
    useStore.getState().syncTokens([createUiToken()]);

    expect(useStore.getState().knownTokens).toBe(before);
  });
});
