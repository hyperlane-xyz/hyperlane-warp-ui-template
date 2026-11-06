import type { Locator, WebSocketRoute } from '@playwright/test';

import type { QuoteStep } from '../../src/features/api/types';
import type { RelayState } from '../../src/features/messages/diagnostics';
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
      amountOut: '1600000000000123',
      path: [bscUsdc, bscWbnb],
      poolCount: 1,
    });
  return steps;
}

async function expectCompactRoute(stages: Locator) {
  expect(await stages.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
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

for (const kind of ['bridge', 'origin', 'destination', 'both', 'legacy', 'recovery', 'finalized']) {
  const taggedFinality = kind === 'finalized';
  const directBridge = kind === 'bridge' || kind === 'origin' || taggedFinality;
  const recoverMessages = kind === 'recovery';
  const swapStages =
    kind === 'bridge' || taggedFinality
      ? undefined
      : {
          origin: kind === 'origin' || kind === 'both',
          destination:
            kind === 'destination' || kind === 'both' || kind === 'legacy' || recoverMessages,
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
      ({
        ids,
        bodies,
        originTx,
        address,
        directBridge,
        routeSteps,
        legacyLabels,
        recoverMessages,
        taggedFinality,
      }) => {
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
              chainMetadataOverrides: {
                base: { blocks: { confirmations: 2, reorgPeriod: 15 } },
                bsc: {
                  blocks: { confirmations: 1, reorgPeriod: taggedFinality ? 'finalized' : 5 },
                },
              },
              selectedTransactionId: 'progress-fixture',
              transactionHistory: [
                {
                  id: 'progress-fixture',
                  type: 'transfer',
                  data: {
                    status: recoverMessages ? 'confirming-origin' : 'bridging',
                    routeSteps,
                    timestamp: Date.now() - 120_000,
                    srcChain: 8453,
                    dstChain: 56,
                    srcToken: '0x0000000000000000000000000000000000000000',
                    dstToken: '0x0000000000000000000000000000000000000000',
                    srcTokenMeta: { symbol: 'ETH', decimals: 18, chainName: 'base' },
                    dstTokenMeta: { symbol: 'BNB', decimals: 18, chainName: 'bsc' },
                    amountIn: '500000000000000',
                    amountOut: '1600000000000123',
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
                    msgIds: (recoverMessages ? [] : directBridge ? ids.slice(0, 1) : ids).map(
                      (msgId, i) => ({
                        msgId,
                        label: directBridge
                          ? 'warp'
                          : [legacyLabels ? 'commit' : 'bridge', 'commit', 'reveal'][i],
                      }),
                    ),
                  },
                },
              ],
            },
          }),
        );
      },
      {
        ids,
        bodies,
        originTx,
        address,
        directBridge,
        routeSteps,
        legacyLabels: kind === 'legacy',
        recoverMessages,
        taggedFinality,
      },
    );
    const entry = (index: number) => ({
      id: index + 1,
      msg_id: ids[index],
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
      origin_block_height: '100',
      destination_block_height:
        index < 2 && !reorg ? (index === 1 || directBridge ? '256' : '100') : null,
    });
    let liveSocket: WebSocketRoute | undefined;
    let diagnosticsSocket: WebSocketRoute | undefined;
    let snapshotRequests = 0;
    let originSnapshotRequests = 0;
    let originIndexed = !recoverMessages;
    let socketConnections = 0;
    let liveAvailable = true;
    let readyConnections = 0;
    const sendHeads = () => {
      for (const [domain, height] of [
        [8453, originConfirmed ? 256 : 100],
        [56, destinationConfirmed ? 261 : 256],
      ]) {
        liveSocket?.send(
          JSON.stringify({
            type: 'block',
            domain,
            height: String(height),
            headHeight: String(height),
            hash: `0x${'cc'.repeat(32)}`,
          }),
        );
      }
    };
    await page.routeWebSocket('**/messages?**', (socket) => {
      if (new URL(socket.url()).searchParams.get('diagnostics') === 'true') {
        diagnosticsSocket = socket;
        socket.send(JSON.stringify({ type: 'diagnostics_unavailable' }));
        return;
      }
      liveSocket = socket;
      socketConnections++;
      if (!liveAvailable) {
        socket.close();
        return;
      }
      readyConnections++;
      socket.send(JSON.stringify({ type: 'ready', customDomains: [8453, 56] }));
      sendHeads();
    });
    await page.route('**/*graphql*', async (route) => {
      snapshotRequests++;
      const request = route.request().postDataJSON();
      expect(request.query).toContain('confirmations: 0');
      const id = String(request?.variables?.msgId ?? '').replace('\\x', '0x');
      const index = ids.indexOf(id);
      const byOriginTx = !!request.variables?.originTxHash;
      if (byOriginTx) originSnapshotRequests++;
      await route.fulfill({
        json: {
          data: {
            message_view: byOriginTx
              ? originIndexed
                ? ids.map((_, i) => entry(i))
                : []
              : index < 0
                ? []
                : [entry(index)],
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
      if (payload.method === 'eth_getBlockByNumber') {
        expect(payload.params[0]).toBe('finalized');
        await route.fulfill({
          json: {
            jsonrpc: '2.0',
            id: payload.id,
            result: {
              number: destinationConfirmed ? '0x100' : '0xff',
              hash: `0x${'cc'.repeat(32)}`,
              parentHash: `0x${'cc'.repeat(32)}`,
              timestamp: '0x65000000',
              nonce: '0x0000000000000000',
              difficulty: '0x0',
              gasLimit: '0x100000',
              gasUsed: '0x5208',
              miner: address,
              extraData: '0x',
              transactions: [],
            },
          },
        });
        return;
      }
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
              ? '0x105'
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
    if (recoverMessages) {
      await expect.poll(() => originSnapshotRequests, { timeout: 60_000 }).toBeGreaterThan(0);
      const pending = page.getByRole('article', { name: 'Origin transaction', exact: true });
      await expect(pending).toBeVisible();
      await expect(pending.getByRole('status')).toHaveText('Confirming origin · 1/15');
      await expect(pending.getByRole('link', { name: 'View origin transaction' })).toHaveAttribute(
        'href',
        new RegExp(originTx),
      );
      originIndexed = true;
      // One pushed message must recover the entire origin transaction, including reveal.
      liveSocket?.send(JSON.stringify({ type: 'message_upsert', data: entry(0) }));
    }

    const progress = page.getByRole('region', { name: 'Transfer progress' });
    await expect(progress).toBeVisible({ timeout: 60_000 });
    await expect(progress.locator('article')).toHaveCount(directBridge ? 1 : 3);
    await expect(
      page.getByRole('article', { name: 'Origin transaction', exact: true }),
    ).toHaveCount(0);
    const stages = page.getByRole('region', { name: 'Transfer route' });
    await expect(stages.getByLabel('Amount to send', { exact: true })).toHaveText(
      swapStages ? '0.0005' : '0.0005 ETH',
    );
    await expect(stages.getByLabel('Expected amount to receive', { exact: true })).toHaveText(
      swapStages ? '0.0016' : '0.0016 BNB',
    );
    await stages.getByLabel('Amount to send', { exact: true }).hover();
    await expect(page.getByRole('tooltip')).toHaveText('0.0005 ETH');
    await page.mouse.move(0, 0);
    await stages.getByLabel('Expected amount to receive', { exact: true }).hover();
    await expect(page.getByRole('tooltip')).toHaveText('0.001600000000000123 BNB');
    await page.mouse.move(0, 0);
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
      await expect(stages.getByLabel('Amount to send', { exact: true })).toHaveText('0.0005 ETH');
      await expect(stages.getByLabel('Expected amount to receive', { exact: true })).toHaveText(
        '0.0016 BNB',
      );
      await expect(
        stages.getByRole('group', { name: 'Transfer: Delivered', exact: true }),
      ).toBeVisible();
    }
    const outcome = page.getByTestId('transfer-outcome');
    if (directBridge) {
      const bridge = progress.getByRole('article', { name: 'Bridge funds' });
      await expect(bridge.getByRole('status')).toHaveText(
        taggedFinality ? 'Delivered' : 'Delivered · 0/5 confirmations',
      );
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
      await bridge.getByText('Transaction details', { exact: true }).click();
      await expect(bridge).toContainText(
        taggedFinality ? 'Waiting for finalized block' : '0/5 blocks',
      );
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
      await expect(bridge.getByRole('list', { name: 'Message lifecycle stages' })).toHaveCount(1);
      await expect(bridge.getByRole('list', { name: 'Message milestones' })).toHaveCount(0);
      await expect(
        bridge.locator('.relay-stages li').filter({ hasText: /^Deliver$/ }),
      ).toHaveAttribute('data-reached', 'true');
      await expect(
        bridge.locator('.relay-stages li').filter({ hasText: /^Confirm$/ }),
      ).toHaveAttribute('aria-current', 'step');
      await page.locator('.transfer-details-modal').evaluate((element) => element.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await progress.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      if (swapStages) await expectCompactRoute(stages);
      await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
      await page.reload();
      await expect(outcome).toContainText('Funds are available to use');
      destinationConfirmed = true;
      sendHeads();
      await expect(bridge.getByRole('status')).toHaveText('Confirmed', { timeout: 20_000 });
      await expect(outcome).toContainText('Funds are available to use');
      const beforeIdle = snapshotRequests;
      await page.waitForTimeout(11_000);
      expect(snapshotRequests).toBe(beforeIdle);
      // Record transient regressions too: the final assertion alone misses flicker.
      await bridge.getByRole('status').evaluate((element) => {
        const history = [element.textContent];
        element.setAttribute('data-status-history', JSON.stringify(history));
        const observer = new MutationObserver(() => {
          history.push(element.textContent);
          element.setAttribute('data-status-history', JSON.stringify(history));
        });
        observer.observe(element, { childList: true, characterData: true, subtree: true });
      });
      const beforeReconnect = socketConnections;
      liveSocket?.close();
      await expect.poll(() => socketConnections).toBeGreaterThan(beforeReconnect);
      await expect.poll(() => snapshotRequests).toBeGreaterThan(beforeIdle);
      await expect(bridge.getByRole('status')).toHaveText('Confirmed');
      const confirmationHistory = JSON.parse(
        (await bridge.getByRole('status').getAttribute('data-status-history'))!,
      );
      expect(new Set(confirmationHistory)).toEqual(new Set(['Confirmed']));
      reorg = true;
      liveSocket?.send(
        JSON.stringify({
          type: 'rollback',
          confirmations: 0,
          domain: 56,
          fromHeight: '257',
          toHeight: '99',
        }),
      );
      await expect(outcome).toHaveCount(0, { timeout: 25_000 });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(localStorage.getItem('app-state') || '{}').state.transactionHistory[0].data
                .destinationTxHash,
          ),
        )
        .toBeUndefined();
      if (kind === 'bridge') {
        // A blocked WebSocket must still recover status through the GraphQL fallback.
        liveAvailable = false;
        liveSocket?.close();
        const beforeFallback = snapshotRequests;
        await expect
          .poll(() => snapshotRequests, { timeout: 15_000 })
          .toBeGreaterThan(beforeFallback);
        const beforeReady = readyConnections;
        liveAvailable = true;
        await expect.poll(() => readyConnections, { timeout: 15_000 }).toBeGreaterThan(beforeReady);
      }
      // A new delivery transaction must replace the rolled-back hash, without a timer/refetch.
      reorg = false;
      destinationConfirmed = true;
      sendHeads();
      liveSocket?.send(
        JSON.stringify({
          type: 'message_upsert',
          data: {
            ...entry(0),
            destination_tx_hash: destinationTx,
            destination_block_height: '100',
          },
        }),
      );
      await expect(outcome).toContainText('Funds are available to use');
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(localStorage.getItem('app-state') || '{}').state.transactionHistory[0].data
                .destinationTxHash,
          ),
        )
        .toBe(destinationTx);
      reorg = true;
      liveSocket?.send(
        JSON.stringify({
          type: 'rollback',
          confirmations: 0,
          domain: 56,
          fromHeight: '257',
          toHeight: '99',
        }),
      );
      await expect(outcome).toHaveCount(0);

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
    await expect(reveal.getByRole('status')).toHaveText('Confirming origin · 0/15');
    const spinner = reveal.locator(
      ':scope > .message-disclosure > summary .message-status-spinner',
    );
    await expect(spinner).toBeVisible();
    await expect(
      bridge.locator(':scope > .message-disclosure > summary .message-status-spinner'),
    ).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(spinner).toHaveCSS('animation-name', 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(spinner).not.toHaveCSS('animation-name', 'none');
    await reveal.locator(':scope > .message-disclosure > summary').click();
    await expect(reveal.getByRole('listitem').first().locator(':scope > span').first()).toHaveCSS(
      'height',
      '3px',
    );
    await expect(reveal.getByRole('list', { name: 'Message lifecycle stages' })).toBeVisible();
    await reveal.getByText('Transaction details', { exact: true }).click();
    await expect(reveal).toContainText('0/15 blocks');
    liveSocket?.send(
      JSON.stringify({
        type: 'block',
        domain: 8453,
        height: '101',
        headHeight: '101',
        hash: `0x${'cc'.repeat(32)}`,
      }),
    );
    await expect(reveal.getByRole('status')).toHaveText('Confirming origin · 1/15');
    await expect(reveal).toContainText('1/15 blocks');
    originConfirmed = true;
    sendHeads();
    await expect(bridge.getByRole('status')).toHaveText('Confirmed');
    await expect(commit.getByRole('status')).toHaveText('Confirming destination · 0/5');
    await commit.locator(':scope > .message-disclosure > summary').click();
    await expect(
      commit.locator('.relay-stages li').filter({ hasText: /^Deliver$/ }),
    ).toHaveAttribute('data-reached', 'true');
    await expect(
      commit.locator('.relay-stages li').filter({ hasText: /^Confirm$/ }),
    ).toHaveAttribute('aria-current', 'step');
    await commit.getByText('Transaction details', { exact: true }).click();
    await expect(commit).toContainText('0/5 blocks');
    await expect(reveal.getByRole('status')).toHaveText('Awaiting relayer delivery', {
      timeout: 20_000,
    });
    await expect(
      reveal.locator('.relay-stages li').filter({ hasText: /^Deliver$/ }),
    ).toHaveAttribute('data-reached', 'false');
    await expect(
      reveal.locator('.relay-stages li').filter({ hasText: /^Confirm$/ }),
    ).toHaveAttribute('data-reached', 'false');
    await reveal.locator(':scope > .message-disclosure > summary').click();
    await commit.locator(':scope > .message-disclosure > summary').click();
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
    if (swapStages) await expectCompactRoute(stages);
    await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
    const panelTop = (await page.getByTestId('transfer-details').boundingBox())?.y;
    await reveal.locator(':scope > .message-disclosure > summary').click();
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
    liveSocket?.send(
      JSON.stringify({
        type: 'rollback',
        confirmations: 0,
        domain: 56,
        fromHeight: '256',
        toHeight: '99',
      }),
    );
    await expect(bridge.getByRole('status')).not.toHaveText('Confirmed', { timeout: 25_000 });
    await bridge.locator(':scope > .message-disclosure > summary').click();
    await expect(
      bridge.locator('.relay-stages li').filter({ hasText: /^Deliver$/ }),
    ).toHaveAttribute('data-reached', 'false');

    // All three message IDs share one diagnostics subscription and keep separate trees.
    expect(
      diagnosticsSocket && new URL(diagnosticsSocket.url()).searchParams.get('messageIds'),
    ).toBe(ids.map((id) => id.slice(2)).join(','));
    const types = ['Null', 'CcipRead', 'MessageIdMultisig'];
    const labels = ['Null', 'CCIP Read', 'Message ID Multisig'];
    for (const [index, row] of [bridge, commit, reveal].entries()) {
      const sendProof = (
        verification: string | null,
        metadata_error: string | null,
        relayState?: RelayState,
      ) =>
        diagnosticsSocket?.send(
          JSON.stringify({
            type: 'diagnostics',
            data: {
              version: 1,
              message_id: ids[index],
              partial: false,
              activities: [
                {
                  id: '1',
                  relayer: address,
                  version: 1,
                  observed_at: '2026-11-06 15:00:00',
                  activity: {
                    type: 'snapshot',
                    state: relayState ?? {
                      phase: metadata_error ? 'awaiting_signatures' : 'ready_to_submit',
                      tree_root: 'root',
                      modules: [
                        {
                          node_id: 'root',
                          ism: address,
                          module_type: types[index],
                          discovered: true,
                          children: [],
                          metadata_status: metadata_error ? 'blocked' : 'ready',
                          metadata_error,
                          verification,
                        },
                      ],
                    },
                  },
                },
              ],
            },
          }),
        );
      if ((await row.locator(':scope > .message-disclosure').getAttribute('open')) === null)
        await row.locator(':scope > .message-disclosure > summary').click();
      if (kind === 'both' && index === 2) {
        sendProof(null, 'Awaiting validator signatures');
        await expect(row.locator('.ism-node')).toHaveAttribute('data-state', 'waiting');
        await expect(row.locator('.ism-status-label')).toHaveText('Waiting');
        sendProof('failed', null);
        await expect(row.locator('.ism-status-label')).toHaveText('Attempt failed');
        const candidate: RelayState = {
          phase: 'preparing',
          tree_root: 'root',
          modules: [
            {
              node_id: 'root',
              ism: address,
              module_type: 'Aggregation',
              threshold: 1,
              children: [
                { node_id: 'routing', ism: address },
                { node_id: 'other', ism: address },
              ],
            },
            {
              node_id: 'routing',
              ism: address,
              module_type: 'Routing',
              children: [{ node_id: 'leaf', ism: address }],
              selected_children: ['leaf'],
              metadata_error: 'Metadata build failed',
            },
            { node_id: 'leaf', ism: address, children: [], verification: 'failed' },
            { node_id: 'other', ism: address, children: [], verification: 'succeeded' },
          ],
        };
        const routing = row.locator('.ism-node > summary').filter({ hasText: 'Routing' });
        sendProof(null, null, candidate);
        await expect(routing.locator('.ism-status-label')).toHaveText('Waiting');
        await expect(row.locator('.ism-node[data-state="waiting"]')).toHaveCount(2);
        sendProof(null, null, { ...candidate, phase: 'retrying' });
        await expect(row.locator('.ism-node[data-state="failed"]')).toHaveCount(2);
        sendProof(null, null, {
          ...candidate,
          phase: 'ready_to_submit',
          modules: [
            { ...candidate.modules[0], selected_children: ['other'], verified: 1 },
            ...candidate.modules.slice(1),
          ],
        });
        await expect(routing.locator('.ism-status-label')).toHaveText('Unused');
        await expect(row.locator('.ism-node[data-state="unused"]')).toHaveCount(2);
      }
      sendProof('succeeded', null);
    }
    for (const [index, row] of [bridge, commit, reveal].entries()) {
      await expect(row.getByRole('list', { name: 'ISM verification tree' })).toBeVisible();
      await expect(row.locator('.ism-node > summary')).toContainText(labels[index]);
      await expect(row.locator('.ism-status-label')).toHaveText('Passed');
      await expect(row.getByRole('list', { name: 'Message milestones' })).toHaveCount(0);
    }
    await page.screenshot({
      path: testInfo.outputPath('three-message-proofs.png'),
      fullPage: true,
    });
  });
}
