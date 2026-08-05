import { describe, expect, test } from 'vitest';

import type { RouteResponse } from './api/types';
import {
  mergeMigrationChainMetadata,
  mergeKnownTokens,
  mergeTransferTransactionUpdate,
  migratePersistedAppState,
  removeFinalTransferRoute,
} from './store';
import type { UiToken } from './tokens/types';
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

describe('mergeKnownTokens', () => {
  test('returns same map when incoming tokens are unchanged', () => {
    const token = uiToken();
    const known = new Map([[`${token.chainId}-${token.address.toLowerCase()}`, token]]);

    expect(mergeKnownTokens(known, [token])).toBe(known);
  });

  test('updates changed token metadata', () => {
    const token = uiToken({ decimals: 6, logoURI: '/old.svg', canSwap: false });
    const known = new Map([[`${token.chainId}-${token.address.toLowerCase()}`, token]]);
    const updated = uiToken({
      decimals: 18,
      logoURI: '/new.svg',
      canSwap: true,
      wrappedAddress: '0x4200000000000000000000000000000000000006',
    });

    const next = mergeKnownTokens(known, [updated]);

    expect(next).not.toBe(known);
    expect(next.get(`${token.chainId}-${token.address.toLowerCase()}`)).toMatchObject({
      decimals: 18,
      logoURI: '/new.svg',
      canSwap: true,
      wrappedAddress: '0x4200000000000000000000000000000000000006',
    });
  });
});

describe('removeFinalTransferRoute', () => {
  test('keeps active transfer routes', () => {
    const routes = new Map([['tx-1', routeResponse()]]);

    expect(removeFinalTransferRoute(routes, 'tx-1', TransferStatus.Bridging)).toBe(routes);
  });

  test('removes route data when transfer is final', () => {
    const routes = new Map([
      ['tx-1', routeResponse()],
      ['tx-2', routeResponse()],
    ]);

    const next = removeFinalTransferRoute(routes, 'tx-1', TransferStatus.ConfirmedDestination);

    expect(next).not.toBe(routes);
    expect(next.has('tx-1')).toBe(false);
    expect(next.has('tx-2')).toBe(true);
  });
});

describe('migratePersistedAppState', () => {
  test('converts production v2 transfer history into transfer transaction history', async () => {
    const msgId = `0x${'33'.repeat(32)}`;
    const migrated = await migratePersistedAppState({
      chainMetadataOverrides: { ethereum: { rpcUrls: [] } },
      transfers: [
        {
          status: 'delivered',
          origin: 'ethereum',
          destination: 'base',
          originTokenAddressOrDenom: TOKEN,
          destTokenAddressOrDenom: DST_TOKEN,
          amount: '100',
          sender: '0x0000000000000000000000000000000000000001',
          recipient: '0x0000000000000000000000000000000000000002',
          originTxHash: '0xorigin',
          originBlockNumber: 123,
          msgId,
          destinationTxHash: '0xdestination',
          timestamp: 1_718_000_000_000,
        },
      ],
    });

    expect(migrated.transactionHistory).toHaveLength(1);
    expect(migrated.transactionHistory[0]).toMatchObject({
      type: 'transfer',
      data: {
        status: TransferStatus.ConfirmedDestination,
        srcChain: 1,
        dstChain: 8453,
        srcToken: TOKEN,
        dstToken: DST_TOKEN,
        amountIn: '100',
        amountOut: '100',
        msgIds: [{ msgId, label: 'bridge' }],
      },
    });
  });

  test('converts v2 transfer history with custom chain metadata overrides', async () => {
    const migrated = await migratePersistedAppState({
      chainMetadataOverrides: {
        customorigin: { chainId: 123, domainId: 123 },
        customdestination: { chainId: 456, domainId: 456 },
      },
      transfers: [
        {
          status: 'fetching-attestation',
          origin: 'customorigin',
          destination: 'customdestination',
          originTokenAddressOrDenom: TOKEN,
          destTokenAddressOrDenom: DST_TOKEN,
          amount: '100',
          sender: '0x0000000000000000000000000000000000000001',
          recipient: '0x0000000000000000000000000000000000000002',
          timestamp: 1_718_000_000_000,
        },
      ],
    });

    expect(migrated.transactionHistory[0]).toMatchObject({
      data: {
        status: TransferStatus.Bridging,
        srcChain: 123,
        dstChain: 456,
      },
    });
  });
});

describe('mergeMigrationChainMetadata', () => {
  test('keeps template filesystem chains available for legacy migration', () => {
    const merged = mergeMigrationChainMetadata(
      { registrychain: { chainId: 1, domainId: 1 } },
      { localchain: { chainId: 2, domainId: 22 } },
    );

    expect(merged).toMatchObject({
      registrychain: { chainId: 1, domainId: 1 },
      localchain: { chainId: 2, domainId: 22 },
    });
  });
});

const TOKEN = '0x1111111111111111111111111111111111111111';
const DST_TOKEN = '0x2222222222222222222222222222222222222222';

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

function uiToken(overrides: Partial<UiToken> = {}): UiToken {
  return {
    chainId: 8453,
    address: '0x0000000000000000000000000000000000000001',
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
    isBridgeToken: true,
    isPoolToken: false,
    canBridge: true,
    canSwap: false,
    bridgeSymbols: ['USDC'],
    warpRouteIds: ['USDC/base'],
    chainName: 'base',
    name: 'USD Coin',
    addressOrDenom: '0x0000000000000000000000000000000000000001',
    ...overrides,
  };
}

function routeResponse(): RouteResponse {
  return {
    steps: [],
    output: '1',
    outputMin: '1',
    executionKind: 'warpDirect',
    connection: null,
    gas: {
      originGas: '0',
      destGas: '0',
    },
    tx: null,
    txs: [],
    approval: null,
  };
}
