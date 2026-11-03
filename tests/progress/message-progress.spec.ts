import type { QuoteStep } from '../../src/features/api/types';
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

const baseWeth = '0x4200000000000000000000000000000000000006';
const baseUsdc = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const bscUsdc = '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d';
const bscWbnb = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
function routeStepsFor(originSwap: boolean, destinationSwap: boolean): QuoteStep[] {
  const steps: QuoteStep[] = [];
  if (originSwap)
    steps.push({
      type: 'swap',
      chain: 8453,
      dex: 'uniswap',
      tokenIn: baseWeth,
      tokenOut: baseUsdc,
      amountIn: '500000000000000',
      amountOut: '1000000',
      path: [baseWeth, baseUsdc],
      poolCount: 1,
    });
  steps.push({
    type: 'bridge',
    chain: 8453,
    destChain: 56,
    asset: baseUsdc,
    router: address,
    amountIn: '1000000',
    amountOut: '1000000',
    bridgeSymbol: 'USDC',
    warpRouteId: 'USDC/mainnet-cctp-v2-fast',
    fee: {
      tokenFee: '0',
      igpToken: baseWeth,
      igpAmount: '0',
      igpIncludedInAmountIn: false,
      localNativeFee: '0',
    },
  });
  if (destinationSwap)
    steps.push({
      type: 'swap',
      chain: 56,
      dex: 'pancakeswap',
      tokenIn: bscUsdc,
      tokenOut: bscWbnb,
      amountIn: '1000000',
      amountOut: '1600000000000000',
      path: [bscUsdc, bscWbnb],
      poolCount: 1,
    });
  return steps;
}

for (const kind of ['bridge', 'origin', 'destination', 'both']) {
  const directBridge = kind === 'bridge' || kind === 'origin';
  const swapStages =
    kind === 'bridge'
      ? undefined
      : {
          origin: kind === 'origin' || kind === 'both',
          destination: kind === 'destination' || kind === 'both',
        };
  const routeSteps = routeStepsFor(!!swapStages?.origin, !!swapStages?.destination);
  test(`${kind}: tracks route stages, message delivery, and reloads`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    let reorg = false;
    let originConfirmed = directBridge;
    let destinationConfirmed = false;
    await page.addInitScript(
      ({ ids, bodies, originTx, address, directBridge, routeSteps }) => {
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
                    routeSteps,
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
      { ids, bodies, originTx, address, directBridge, routeSteps },
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
    const stages = page.getByRole('region', { name: 'Transfer route' });
    if (swapStages) {
      await expect(page.getByTestId('transfer-motion')).toHaveCount(0);
      await expect(stages.locator('.hyperswap-step')).toHaveCount(
        1 + Number(swapStages.origin) + Number(swapStages.destination),
      );
      if (swapStages.origin)
        await expect(
          stages.getByRole('group', { name: 'Origin swap: Complete', exact: true }),
        ).toBeVisible();
      if (!swapStages.origin) await expect(stages).not.toContainText('Origin swap');
      if (!swapStages.destination) await expect(stages).not.toContainText('Destination swap');
      await expect(
        stages.getByRole('group', { name: 'Transfer: Delivered', exact: true }),
      ).toBeVisible();
      if (swapStages.destination)
        await expect(
          stages.getByRole('group', {
            name: 'Destination swap: Awaiting authorization',
            exact: true,
          }),
        ).toBeVisible();
      const spacing = await stages.evaluate((element) => {
        const widths = Array.from(element.querySelectorAll('.hyperswap-step')).map(
          (step) => step.getBoundingClientRect().width,
        );
        const centers = Array.from(element.querySelectorAll('.hyperswap-asset')).map((asset) => {
          const rect = asset.getBoundingClientRect();
          return rect.left + rect.width / 2;
        });
        return { widths, gaps: centers.slice(1).map((center, index) => center - centers[index]) };
      });
      expect(new Set(spacing.widths)).toEqual(new Set([96]));
      expect(new Set(spacing.gaps).size).toBe(1);
      const deliveredEdge = stages.getByRole('group', { name: 'Transfer: Delivered', exact: true });
      await expect(deliveredEdge.locator('.hyperswap-arrow')).toHaveCSS(
        'color',
        'rgb(60, 131, 94)',
      );
      await expect(stages).not.toContainText(/Wrap|Unwrap|PancakeSwap|Uniswap/);
      await expect(stages.locator('.hyperswap-leg')).toHaveCount(
        2 + Number(swapStages.origin) + Number(swapStages.destination),
      );
      if (swapStages.destination) {
        const destination = stages.getByRole('group', {
          name: 'Destination swap: Awaiting authorization',
          exact: true,
        });
        await expect(destination).toHaveAttribute('aria-current', 'step');
        await expect(destination.locator('.message-status-spinner')).toBeVisible();
        await expect(destination.locator('.hyperswap-arrow')).not.toHaveCSS(
          'color',
          'rgb(60, 131, 94)',
        );
      }
    } else {
      await expect(stages.locator('.hyperswap-step')).toHaveCount(1);
      await expect(
        stages.getByRole('group', { name: 'Transfer: Delivered', exact: true }),
      ).toBeVisible();
    }
    const outcome = page.getByTestId('transfer-outcome');
    if (directBridge) {
      const bridge = progress.getByRole('article', { name: 'Bridge funds' });
      await expect(bridge.getByRole('status')).toHaveText('Delivered');
      await expect(outcome).toHaveText('Funds are available to use on Binance.');
      await expect(
        page.getByText('Transfer complete! Funds have arrived.', { exact: true }),
      ).toHaveCount(0);
      await expect(bridge).not.toContainText('Funds are available to use');
      await expect(page.getByTestId('transfer-headline')).toHaveText('Transfer complete');
      await expect(page.getByTestId('transfer-motion')).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath('desktop-collapsed.png'),
        fullPage: true,
      });
      const dialog = page.getByTestId('transfer-details');
      await expect(dialog.getByText('Sender Address', { exact: true })).toHaveCount(0);
      await expect(dialog.getByText('Recipient Address', { exact: true })).toHaveCount(0);
      await expect(dialog.getByText('Origin Transaction Hash', { exact: true })).toHaveCount(0);
      await expect(dialog.getByText('Destination Transaction Hash', { exact: true })).toHaveCount(
        0,
      );
      await expect(dialog.getByText('Bridge Message ID', { exact: true })).toHaveCount(0);
      await bridge.locator('summary').click();
      await expect(bridge).toContainText('0/1 blocks');
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
      await page.locator('.transfer-details-modal').evaluate((element) => element.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await progress.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      if (swapStages) {
        expect(await stages.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
          true,
        );
        const layout = await stages.evaluate((element) => {
          const region = element.getBoundingClientRect();
          return Array.from(element.querySelectorAll('.hyperswap-leg')).map((leg) => {
            const rect = leg.getBoundingClientRect();
            return {
              top: Math.round(rect.top),
              inside: rect.left >= region.left - 1 && rect.right <= region.right + 1,
            };
          });
        });
        expect(layout.every((leg) => leg.inside)).toBe(true);
        expect(new Set(layout.map((leg) => leg.top)).size).toBe(1);
        expect(
          new Set(
            await stages
              .locator('.hyperswap-step')
              .evaluateAll((steps) => steps.map((step) => step.getBoundingClientRect().width)),
          ).size,
        ).toBe(1);
      }
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
    const spinner = reveal.locator('summary .message-status-spinner');
    await expect(spinner).toBeVisible();
    await expect(bridge.locator('summary .message-status-spinner')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(spinner).toHaveCSS('animation-name', 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(spinner).not.toHaveCSS('animation-name', 'none');
    await reveal.locator('summary').click();
    await expect(reveal.getByRole('listitem').first().locator(':scope > span').first()).toHaveCSS(
      'height',
      '4px',
    );
    await expect(
      reveal.getByRole('listitem', { name: 'Origin confirmed: In progress' }),
    ).toBeVisible();
    await expect(reveal).toContainText('1/3 blocks');
    originConfirmed = true;
    await expect(bridge.getByRole('status')).toHaveText('Confirmed');
    await expect(commit.getByRole('status')).toHaveText('Confirming destination');
    await commit.locator('summary').click();
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
    await reveal.locator('summary').click();
    await commit.locator('summary').click();
    await expect(page.getByTestId('transfer-headline')).toHaveText('Waiting for message delivery');
    await expect(page.getByTestId('transfer-motion')).toHaveCount(0);
    for (const row of await progress.locator('article').all()) {
      const box = await row.boundingBox();
      expect(box?.height).toBeLessThanOrEqual(60);
    }
    await page.locator('.transfer-details-modal').evaluate((element) => element.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(progress).toBeVisible();
    expect(await progress.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (swapStages) {
      expect(await stages.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      const layout = await stages.evaluate((element) => {
        const region = element.getBoundingClientRect();
        return Array.from(element.querySelectorAll('.hyperswap-leg')).map((leg) => {
          const rect = leg.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            inside: rect.left >= region.left - 1 && rect.right <= region.right + 1,
          };
        });
      });
      expect(layout.every((leg) => leg.inside)).toBe(true);
      expect(new Set(layout.map((leg) => leg.top)).size).toBe(1);
      expect(
        new Set(
          await stages
            .locator('.hyperswap-step')
            .evaluateAll((steps) => steps.map((step) => step.getBoundingClientRect().width)),
        ).size,
      ).toBe(1);
    }
    await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
    const panelTop = (await page.getByTestId('transfer-details').boundingBox())?.y;
    await reveal.locator('summary').click();
    expect((await page.getByTestId('transfer-details').boundingBox())?.y).toBe(panelTop);
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
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'dark');
    await expect(page.getByTestId('transfer-headline')).toHaveCSS('color', 'rgb(242, 228, 255)');
    await page.screenshot({
      path: testInfo.outputPath('mobile-dark.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.reload();
    await expect(progress.locator('article')).toHaveCount(3);
    await expect(stages.locator('.hyperswap-step')).toHaveCount(kind === 'both' ? 3 : 2);
    await expect(bridge.getByRole('status')).toHaveText('Confirmed');
    reorg = true;
    await expect(bridge.getByRole('status')).not.toHaveText('Confirmed', { timeout: 25_000 });
    await bridge.locator('summary').click();
    await expect(
      bridge.getByRole('listitem', { name: 'Delivered: In progress', exact: true }),
    ).toBeVisible();
  });
}
