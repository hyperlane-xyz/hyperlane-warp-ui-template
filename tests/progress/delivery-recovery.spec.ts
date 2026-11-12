import type { Page, WebSocketRoute } from '@playwright/test';

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

async function setup(page: Page, scenario: 'empty' | 'offline' | 'replacement') {
  const swap = scenario === 'replacement';
  let deliveryHash = oldHash;
  let socket: WebSocketRoute | undefined;
  let snapshots = 0;
  const mailboxReads: string[] = [];
  const message = () => ({
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
  });
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
              base: { blocks: { confirmations: 1, reorgPeriod: 1, estimateBlockTime: 2 } },
              bsc: { blocks: { confirmations: 1, reorgPeriod: 1, estimateBlockTime: 1 } },
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
      connection.send(
        JSON.stringify({
          type: 'diagnostics',
          data: {
            version: 1,
            message_id: messageId,
            partial: false,
            activities: [],
          },
        }),
      );
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
          message_view: swap ? [message()] : [],
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
      case 'eth_getLogs':
        mailboxReads.push(payload.method);
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
    connected: () => !!socket,
    mailboxReads,
    deliver: () => socket?.send(JSON.stringify({ type: 'message_upsert', data: message() })),
    checkedReceipts,
    reconnectWithReplacement: () => {
      deliveryHash = newHash;
      socket?.close();
    },
  };
}

for (const scenario of ['empty', 'offline'] as const) {
  test(`stream supplies delivery when the snapshot is ${scenario}, without mailbox polling`, async ({
    page,
  }) => {
    const state = await setup(page, scenario);
    const bridge = page.getByRole('article', { name: 'Bridge funds' });
    await expect(bridge).toBeVisible({ timeout: 60_000 });
    await expect(bridge.locator(':scope > .message-disclosure')).toHaveAttribute('open', '');
    await expect(bridge.locator('.ism-disclosure')).not.toHaveAttribute('open', '');
    const explorerLink = page.getByTestId('transfer-footer').getByRole('link', {
      name: 'Track on Hyperlane Explorer',
    });
    await expect(explorerLink).toHaveAttribute('href', new RegExp(messageId));
    const destinationLink = page.getByRole('link', {
      name: 'View delivery transaction on block explorer',
    });
    await expect(destinationLink).toHaveCount(0);
    await expect.poll(state.snapshots).toBeGreaterThan(0);
    await expect.poll(state.connected).toBe(true);
    await expect(page.getByTestId('transfer-outcome')).toHaveCount(0);
    if (scenario === 'empty') {
      // A known ID with a healthy stream needs no repeated empty snapshot reads.
      await expect(bridge.getByRole('status')).toHaveText('Validating');
      await expect(
        bridge.getByRole('listitem', { name: 'Dispatched', exact: true }),
      ).toHaveAttribute('data-reached', 'true');
      await expect(
        bridge.getByRole('listitem', { name: 'Origin confirmed', exact: true }),
      ).toHaveAttribute('data-reached', 'true');
      const verification = bridge.getByRole('listitem', { name: 'Validated', exact: true });
      await expect(verification).toHaveAttribute('aria-current', 'step');
      await expect(verification).toHaveText('Validating');
      await expect(bridge.locator('.relay-live-status')).toHaveAttribute('data-live', 'true');
      await expect(bridge.locator('.relay-live-dot')).toHaveCSS('animation-name', 'relay-breathe');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(bridge.locator('.relay-live-dot')).toHaveCSS('animation-name', 'none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const snapshots = state.snapshots();
      await page.waitForTimeout(11_000);
      expect(state.snapshots()).toBe(snapshots);
    }
    state.deliver();
    await expect(page.getByTestId('transfer-outcome')).toContainText('Funds are available to use', {
      timeout: 60_000,
    });
    await expect(page.getByTestId('transfer-outcome')).toHaveClass(/sr-only/);
    await expect(explorerLink).toBeVisible();
    await expect(explorerLink).toHaveAttribute('href', new RegExp(messageId));
    await expect(page.getByTestId('transfer-details')).toHaveAttribute(
      'data-status',
      'confirmed-destination',
    );
    await expect(page.getByLabel('Amount to send', { exact: true })).toHaveText('1.5 ETH');
    expect(state.mailboxReads).toEqual([]);
    await expect(destinationLink).toBeVisible();
    await expect(destinationLink).toHaveAttribute('title', oldHash);
    await expect(bridge.getByRole('status')).toHaveText('Confirmed');
    await expect(bridge.locator('.relay-stages li')).toHaveCount(5);
    await expect(bridge.locator('.relay-stages li[data-reached="true"]')).toHaveCount(5);
    await expect(bridge.locator('.relay-stages [aria-current="step"]')).toHaveCount(0);
    await expect(bridge.locator('.message-status-spinner')).toHaveCount(0);
    await expect(bridge.locator('.relay-live-status')).toHaveAttribute('data-live', 'false');
    await expect(bridge.locator('.relay-live-dot')).toHaveCSS('animation-name', 'none');
    await bridge.locator('.ism-disclosure > summary').click();
    await expect(bridge.getByRole('heading', { name: 'Transaction details' })).toBeVisible();
    await expect(bridge).toContainText('Destination confirmations');
    await expect(
      bridge.getByRole('link', { name: 'Delivery transaction (opens in new tab)' }),
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

test('reconnect replaces a stale successful HyperSwap outcome with recovery', async ({ page }) => {
  const state = await setup(page, 'replacement');
  await expect(page.getByTestId('transfer-outcome')).toContainText('Funds are available to use', {
    timeout: 60_000,
  });
  const destinationLink = page.getByRole('link', {
    name: 'View delivery transaction on block explorer',
  });
  await expect(destinationLink).toHaveAttribute('title', oldHash);
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
  await expect(destinationLink).toHaveAttribute('title', newHash);
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
