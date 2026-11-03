import { test, expect } from '../fixtures';

const ids = ['11', '22', '33'].map((byte) => `0x${byte.repeat(32)}`);
const originTx = `0x${'aa'.repeat(32)}`;
const destinationTx = `0x${'bb'.repeat(32)}`;
const address = `0x${'44'.repeat(20)}`;
const bodies = [
  `0x${'00'.repeat(12)}${'44'.repeat(20)}${'00'.repeat(31)}01`,
  `0x01${'11'.repeat(128)}`,
  `0x02${'22'.repeat(64)}`,
];

test('tracks each swap message independently and keeps details through reload', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  let reorg = false;
  await page.addInitScript(
    ({ ids, bodies, originTx, address }) => {
      const existing = localStorage.getItem('app-state');
      if (existing) {
        const persisted = JSON.parse(existing);
        persisted.state.selectedTransactionId = 'progress-fixture';
        localStorage.setItem('app-state', JSON.stringify(persisted));
        return;
      }
      localStorage.setItem(
        'app-state',
        JSON.stringify({
          version: 6,
          state: {
            chainMetadataOverrides: {},
            selectedTransactionId: 'progress-fixture',
            transactionHistory: [
              {
                id: 'progress-fixture',
                type: 'transfer',
                data: {
                  status: 'bridging',
                  timestamp: Date.now() - 120_000,
                  srcChain: 8453,
                  dstChain: 56,
                  srcToken: '0x0000000000000000000000000000000000000000',
                  dstToken: '0x0000000000000000000000000000000000000000',
                  srcTokenMeta: { symbol: 'ETH', decimals: 18, chainName: 'base' },
                  dstTokenMeta: { symbol: 'BNB', decimals: 18, chainName: 'bsc' },
                  amountIn: '500000000000000',
                  amountOut: '1600000000000000',
                  sender: address,
                  recipient: address,
                  originTxHash: originTx,
                  destinationOutcome: {
                    bridgeToken: address,
                    dstToken: address,
                    dstIsNative: true,
                  },
                  msgIds: ids.map((msgId, i) => ({
                    msgId,
                    label: ['bridge', 'commit', 'reveal'][i],
                  })),
                },
              },
            ],
          },
        }),
      );
    },
    { ids, bodies, originTx, address },
  );
  await page.route('**/*graphql*', async (route) => {
    const request = route.request().postDataJSON();
    const id = String(request?.variables?.msgId ?? '').replace('\\x', '0x');
    const index = ids.indexOf(id);
    await route.fulfill({
      json: {
        data: {
          message_view:
            index < 0
              ? []
              : [
                  {
                    id: index + 1,
                    msg_id: id,
                    nonce: index,
                    sender: address,
                    recipient: address,
                    message_body: bodies[index],
                    is_delivered: index < 2 && !reorg,
                    send_occurred_at: '2026-11-03T10:00:00',
                    delivery_occurred_at: index < 2 ? '2026-11-03T10:01:00' : null,
                    origin_chain_id: 8453,
                    origin_domain_id: 8453,
                    origin_tx_hash: originTx,
                    origin_tx_sender: address,
                    origin_tx_recipient: address,
                    destination_chain_id: 56,
                    destination_domain_id: 56,
                    destination_tx_hash: index < 2 && !reorg ? destinationTx : null,
                    destination_tx_sender: address,
                    destination_tx_recipient: address,
                    origin_block_height: 100,
                  },
                ],
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
    const receipt = {
      transactionHash: payload.params?.[0],
      blockHash: `0x${'cc'.repeat(32)}`,
      blockNumber: '0x64',
      transactionIndex: '0x0',
      from: address,
      to: address,
      gasUsed: '0x5208',
      cumulativeGasUsed: '0x5208',
      logs: [],
      logsBloom: `0x${'00'.repeat(256)}`,
      status: '0x1',
      effectiveGasPrice: '0x1',
      type: '0x2',
    };
    const result =
      payload.method === 'eth_getTransactionReceipt'
        ? receipt
        : payload.method === 'eth_blockNumber'
          ? '0x100'
          : payload.method === 'eth_chainId'
            ? route.request().url().includes('base')
              ? '0x2105'
              : '0x38'
            : payload.method === 'eth_getLogs'
              ? []
              : `0x${'00'.repeat(32)}`;
    await route.fulfill({ json: { jsonrpc: '2.0', id: payload.id, result } });
  });
  await page.goto(process.env.PROGRESS_TEST_URL ?? 'http://localhost:3000');
  const progress = page.getByRole('region', { name: 'Transfer progress' });
  await expect(progress).toBeVisible({ timeout: 60_000 });
  await expect(progress.locator('details')).toHaveCount(3);
  const reveal = progress.locator('details').filter({ hasText: 'Reveal authorization' });
  await reveal.locator('summary').click();
  await expect(reveal.locator('summary')).toContainText('Awaiting delivery');
  await expect(reveal).toContainText('Commitment');
  await expect(reveal.getByRole('link', { name: ids[2] })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
  await page.reload();
  await expect(progress.locator('details')).toHaveCount(3);
  const bridge = progress.locator('details').filter({ hasText: 'Bridge funds' });
  await expect(bridge.locator('summary')).toContainText('Confirmed');
  reorg = true;
  await expect(bridge.locator('summary')).not.toContainText('Confirmed', { timeout: 25_000 });
});
