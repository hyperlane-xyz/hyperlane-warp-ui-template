import type { Page, WebSocketRoute } from '@playwright/test';
import { toFunctionSelector } from 'viem';

import { test, expect } from '../fixtures';

const messageId = `0x${'11'.repeat(32)}`;
const originHash = `0x${'aa'.repeat(32)}`;
const oldHash = `0x${'bb'.repeat(32)}`;
const newHash = `0x${'cc'.repeat(32)}`;
const blockHash = `0x${'dd'.repeat(32)}`;
const recipient = `0x${'44'.repeat(20)}`;
const bridgeToken = `0x${'55'.repeat(20)}`;
const outputToken = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

async function setup(
  page: Page,
  scenario: 'empty' | 'offline' | 'replacement' | 'rpc-replacement',
) {
  const swap = scenario.endsWith('replacement');
  let deliveryHash = oldHash;
  let socket: WebSocketRoute | undefined;
  let snapshots = 0;
  let mailboxReads = 0;
  const checkedReceipts: string[] = [];
  await page.addInitScript(
    ({ messageId, originHash, oldHash, recipient, bridgeToken, outputToken, swap }) => {
      localStorage.setItem(
        'app-state',
        JSON.stringify({
          version: 6,
          state: {
            selectedTransactionId: 'delivery-test',
            chainMetadataOverrides: {
              base: { blocks: { confirmations: 1, reorgPeriod: 1 } },
              bsc: { blocks: { confirmations: 1, reorgPeriod: 1 } },
            },
            transactionHistory: [
              {
                id: 'delivery-test',
                type: 'transfer',
                data: {
                  status: swap ? 'confirmed-destination' : 'bridging',
                  timestamp: Date.now(),
                  srcChain: 8453,
                  dstChain: 56,
                  srcToken: '0x0000000000000000000000000000000000000000',
                  dstToken: outputToken,
                  srcTokenMeta: { symbol: 'ETH', decimals: 18, chainName: 'base' },
                  dstTokenMeta: { symbol: 'WBNB', decimals: 18, chainName: 'bsc' },
                  amountIn: '1.5',
                  amountOut: '1000000000000000000',
                  sender: recipient,
                  recipient,
                  originTxHash: originHash,
                  destinationTxHash: swap ? oldHash : undefined,
                  msgIds: [{ msgId: messageId, label: swap ? 'reveal' : 'bridge' }],
                  destinationOutcome: swap
                    ? { bridgeToken, dstToken: outputToken, dstIsNative: false }
                    : undefined,
                },
              },
            ],
          },
        }),
      );
    },
    { messageId, originHash, oldHash, recipient, bridgeToken, outputToken, swap },
  );
  await page.routeWebSocket('**/messages?**', (connection) => {
    if (new URL(connection.url()).searchParams.get('diagnostics') === 'true') {
      connection.send(JSON.stringify({ type: 'diagnostics_unavailable' }));
      return;
    }
    socket = connection;
    connection.send(JSON.stringify({ type: 'ready' }));
    for (const domain of [8453, 56])
      connection.send(JSON.stringify({ type: 'block', domain, headHeight: '110' }));
  });
  await page.route('**/*graphql*', async (route) => {
    snapshots++;
    if (scenario === 'offline') return route.fulfill({ status: 503, body: 'Unavailable' });
    await route.fulfill({
      json: {
        data: {
          message_view:
            scenario === 'replacement'
              ? [
                  {
                    msg_id: messageId,
                    sender: recipient,
                    recipient,
                    message_body: null,
                    origin_domain_id: 8453,
                    destination_domain_id: 56,
                    origin_tx_hash: originHash,
                    destination_tx_hash: deliveryHash,
                    origin_block_height: '100',
                    destination_block_height: '100',
                    is_delivered: true,
                    send_occurred_at: '2026-11-04T10:00:00',
                  },
                ]
              : [],
        },
      },
    });
  });
  await page.route('**/*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    let payload;
    try {
      payload = route.request().postDataJSON();
    } catch {
      return route.fallback();
    }
    if (!payload || !('method' in payload) || !String(payload.method).startsWith('eth_'))
      return route.fallback();
    expect(payload.method).not.toBe('eth_sendTransaction');
    const log = (address: string, topics: string[]) => ({
      address,
      topics,
      data: `0x${'00'.repeat(31)}01`,
      blockNumber: '0x64',
      blockHash,
      transactionIndex: '0x0',
      logIndex: '0x0',
      transactionHash: deliveryHash,
      removed: false,
    });
    let result: unknown = '0x0';
    switch (payload.method) {
      case 'eth_chainId':
        result = route.request().url().includes('base') ? '0x2105' : '0x38';
        break;
      case 'eth_blockNumber':
        result = '0x6e';
        break;
      case 'eth_call':
        mailboxReads++;
        // Mailbox.delivered(bytes32), then processedAt(bytes32).
        result = `0x${(payload.params[0].data.startsWith(toFunctionSelector('delivered(bytes32)')) ? '1' : '64').padStart(64, '0')}`;
        break;
      case 'eth_getLogs':
        result = [log(payload.params[0].address, payload.params[0].topics)];
        break;
      case 'eth_getTransactionReceipt': {
        const hash = payload.params[0];
        checkedReceipts.push(hash);
        result = {
          transactionHash: hash,
          blockHash,
          blockNumber: '0x64',
          transactionIndex: '0x0',
          from: recipient,
          to: recipient,
          gasUsed: '0x5208',
          cumulativeGasUsed: '0x5208',
          status: '0x1',
          effectiveGasPrice: '0x1',
          type: '0x2',
          logsBloom: `0x${'00'.repeat(256)}`,
          logs: swap
            ? [
                log(hash === newHash ? bridgeToken : outputToken, [
                  transferTopic,
                  `0x${'00'.repeat(32)}`,
                  `0x${'00'.repeat(12)}${recipient.slice(2)}`,
                ]),
              ]
            : [],
        };
        break;
      }
    }
    await route.fulfill({ json: { jsonrpc: '2.0', id: payload.id, result } });
  });
  await page.goto('http://localhost:3000');
  return {
    snapshots: () => snapshots,
    mailboxReads: () => mailboxReads,
    checkedReceipts,
    reconnectWithReplacement: () => {
      deliveryHash = newHash;
      socket?.close();
    },
  };
}

for (const scenario of ['empty', 'offline'] as const) {
  test(`mailbox completes a transfer when the explorer is ${scenario}`, async ({ page }) => {
    const state = await setup(page, scenario);
    await expect(page.getByTestId('transfer-outcome')).toContainText('Funds are available to use', {
      timeout: 60_000,
    });
    await expect(page.getByTestId('transfer-details')).toHaveAttribute(
      'data-status',
      'confirmed-destination',
    );
    await expect(page.getByLabel('Amount to send', { exact: true })).toHaveText('1.5 ETH');
    expect(state.mailboxReads()).toBeGreaterThan(0);
    const bridge = page.getByRole('article', { name: 'Bridge funds' });
    await bridge.getByText('Transaction details', { exact: true }).click();
    await expect(
      bridge.getByRole('link', { name: 'Destination transaction (opens in new tab)' }),
    ).toHaveAttribute('title', oldHash);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('app-state') || '{}').state.transactionHistory[0].data
              .destinationTxHash,
        ),
      )
      .toBe(oldHash);
  });
}

for (const scenario of ['replacement', 'rpc-replacement'] as const) {
  test(`reconnect replaces a stale successful HyperSwap outcome with recovery: ${scenario}`, async ({
    page,
  }) => {
    const state = await setup(page, scenario);
    await expect(page.getByTestId('transfer-outcome')).toContainText('Funds are available to use', {
      timeout: 60_000,
    });
    const snapshots = state.snapshots();
    state.reconnectWithReplacement();
    await expect.poll(state.snapshots).toBeGreaterThan(snapshots);
    await expect(page.getByTestId('transfer-outcome')).toContainText(
      'intermediate token was automatically returned',
      { timeout: 20_000 },
    );
    await expect(page.getByTestId('transfer-details')).toHaveAttribute(
      'data-status',
      'failed-recovered',
    );
    expect(state.checkedReceipts).toContain(newHash);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('app-state') || '{}').state.transactionHistory[0].data
              .destinationTxHash,
        ),
      )
      .toBe(newHash);
  });
}
