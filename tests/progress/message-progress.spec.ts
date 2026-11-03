import { test, expect } from '../fixtures';

const ids = ['11', '22', '33'].map((byte) => `0x${byte.repeat(32)}`);
const originTx = `0x${'aa'.repeat(32)}`;
const destinationTx = `0x${'bb'.repeat(32)}`;
const pendingDestinationTx = `0x${'dd'.repeat(32)}`;
const address = `0x${'44'.repeat(20)}`;
const messageSenders = ['55', '66', '77'].map((byte) => `0x${byte.repeat(20)}`);
const messageRecipients = ['88', '99', '66'].map((byte) => `0x${byte.repeat(20)}`);
const bodies = [
  `0x${'00'.repeat(12)}${'44'.repeat(20)}${'00'.repeat(31)}01`,
  `0x01${'11'.repeat(128)}`,
  `0x02${'22'.repeat(64)}`,
];

for (const directBridge of [false, true]) {
  test(
    directBridge
      ? 'bridge funds are available at delivery before destination confirmation'
      : 'tracks each swap message independently and keeps details through reload',
    async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      let reorg = false;
      let originConfirmed = directBridge;
      let destinationConfirmed = false;
      await page.addInitScript(
        ({ ids, bodies, originTx, address, directBridge }) => {
          const existing = localStorage.getItem('app-state');
          if (existing) {
            const persisted = JSON.parse(existing);
            const statusOverride = sessionStorage.getItem('progress-status-override');
            if (statusOverride) persisted.state.transactionHistory[0].data.status = statusOverride;
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
                      destinationOutcome: directBridge
                        ? undefined
                        : {
                            bridgeToken: address,
                            dstToken: address,
                            dstIsNative: true,
                          },
                      msgIds: (directBridge ? ids.slice(0, 1) : ids).map((msgId, i) => ({
                        msgId,
                        label: directBridge ? 'warp' : ['bridge', 'commit', 'reveal'][i],
                      })),
                    },
                  },
                ],
              },
            }),
          );
        },
        { ids, bodies, originTx, address, directBridge },
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
                        sender: messageSenders[index],
                        recipient: messageRecipients[index],
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
                        destination_tx_hash:
                          index < 2 && !reorg
                            ? index === 1 || directBridge
                              ? pendingDestinationTx
                              : destinationTx
                            : null,
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
          blockNumber: payload.params?.[0] === pendingDestinationTx ? '0x100' : '0x64',
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
              ? destinationConfirmed
                ? '0x101'
                : originConfirmed
                  ? '0x100'
                  : '0x65'
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
      await expect(progress.locator('article')).toHaveCount(directBridge ? 1 : 3);
      const outcome = page.getByTestId('transfer-outcome');
      if (directBridge) {
        const bridge = progress.getByRole('article', { name: 'Bridge funds' });
        await expect(bridge.getByRole('status')).toHaveText('Delivered');
        await expect(outcome).toHaveText('Funds are available to use on Binance.');
        await expect(bridge).not.toContainText('Funds are available to use');
        await expect(bridge).toContainText('Destination confirmations: 0/1 blocks');
        const dialog = page.getByTestId('transfer-details');
        await expect(dialog.getByText('Sender Address', { exact: true })).toHaveCount(0);
        await expect(dialog.getByText('Recipient Address', { exact: true })).toHaveCount(0);
        await expect(dialog.getByText('Origin Transaction Hash', { exact: true })).toHaveCount(0);
        await expect(dialog.getByText('Destination Transaction Hash', { exact: true })).toHaveCount(
          0,
        );
        await expect(dialog.getByText('Bridge Message ID', { exact: true })).toHaveCount(0);
        await bridge.locator('summary').click();
        await expect(
          bridge.getByRole('link', { name: 'Sender (opens in new tab)', exact: true }),
        ).toHaveAttribute('title', messageSenders[0]);
        await expect(
          bridge.getByRole('link', { name: 'Recipient (opens in new tab)', exact: true }),
        ).toHaveAttribute('title', messageRecipients[0]);
        await expect(
          bridge.getByRole('link', { name: 'Origin transaction (opens in new tab)' }),
        ).toHaveAttribute('title', originTx);
        await expect(
          bridge.getByRole('link', { name: 'Destination transaction (opens in new tab)' }),
        ).toHaveAttribute('title', pendingDestinationTx);
        await expect(
          bridge.getByRole('listitem', { name: 'Delivered: Complete', exact: true }),
        ).toBeVisible();
        await expect(
          bridge.getByRole('listitem', { name: 'Confirmed: In progress', exact: true }),
        ).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await progress.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
        await page.reload();
        await expect(outcome).toContainText('Funds are available to use');
        destinationConfirmed = true;
        await expect(bridge.getByRole('status')).toHaveText('Confirmed', { timeout: 20_000 });
        await expect(outcome).toContainText('Funds are available to use');
        reorg = true;
        await expect(outcome).toHaveCount(0, { timeout: 25_000 });
        for (const [status, message] of [
          ['failed', 'Transfer failed.'],
          ['failed-recovered', 'intermediate token was automatically returned'],
          ['dest-failed', 'intermediate token remains in your ICA'],
        ]) {
          await page.evaluate((status) => {
            sessionStorage.setItem('progress-status-override', status);
          }, status);
          await page.reload();
          await expect(outcome).toHaveAttribute('role', 'alert');
          await expect(outcome).toContainText(message);
          await expect(outcome).not.toContainText('Funds are available to use');
        }
        return;
      }
      await expect(outcome).toHaveCount(0);
      const reveal = progress.locator('article').filter({ hasText: 'Reveal authorization' });
      const bridge = progress.locator('article').filter({ hasText: 'Bridge funds' });
      const commit = progress.locator('article').filter({ hasText: 'Commit authorization' });
      await expect(reveal.getByRole('status')).toHaveText('Confirming origin');
      await expect(
        reveal.getByRole('listitem', { name: 'Origin confirmed: In progress' }),
      ).toBeVisible();
      await expect(reveal).toContainText('1/3 blocks');
      originConfirmed = true;
      await expect(bridge.getByRole('status')).toHaveText('Confirmed');
      await expect(commit.getByRole('status')).toHaveText('Confirming destination');
      await expect(
        commit.getByRole('listitem', { name: 'Delivered: Complete', exact: true }),
      ).toBeVisible();
      await expect(
        commit.getByRole('listitem', { name: 'Confirmed: In progress', exact: true }),
      ).toBeVisible();
      await expect(commit).toContainText('0/1 blocks');
      await expect(reveal.getByRole('status')).toHaveText('Awaiting delivery', { timeout: 20_000 });
      await expect(
        reveal.getByRole('listitem', { name: 'Origin confirmed: Complete' }),
      ).toBeVisible();
      await expect(
        reveal.getByRole('listitem', { name: 'Delivered: In progress', exact: true }),
      ).toBeVisible();
      await expect(
        reveal.getByRole('listitem', { name: 'Confirmed: Waiting', exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(progress).toBeVisible();
      expect(await progress.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
      await reveal.locator('summary').click();
      await expect(
        reveal.getByRole('link', { name: 'Sender (opens in new tab)', exact: true }),
      ).toHaveAttribute('title', messageSenders[2]);
      await expect(
        reveal.getByRole('link', { name: 'Recipient (opens in new tab)', exact: true }),
      ).toHaveAttribute('title', messageRecipients[2]);
      await expect(reveal).toContainText('Commitment');
      const messageLink = reveal.getByRole('link', { name: 'Message ID (opens in new tab)' });
      await expect(messageLink).toBeVisible();
      await expect(messageLink).toHaveAttribute('title', ids[2]);
      await expect(messageLink).toHaveAttribute('target', '_blank');
      await expect(messageLink).toHaveText('0x333333…333333');
      await page.screenshot({ path: testInfo.outputPath('mobile-details.png'), fullPage: true });
      await page.reload();
      await expect(progress.locator('article')).toHaveCount(3);
      await expect(bridge.getByRole('status')).toHaveText('Confirmed');
      reorg = true;
      await expect(bridge.getByRole('status')).not.toHaveText('Confirmed', { timeout: 25_000 });
      await expect(
        bridge.getByRole('listitem', { name: 'Delivered: In progress', exact: true }),
      ).toBeVisible();
    },
  );
}
