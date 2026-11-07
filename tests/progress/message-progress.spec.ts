import type { Locator, WebSocketRoute } from '@playwright/test';

import type { QuoteStep } from '../../src/features/api/types';
import type { RelayState } from '../../src/features/messages/diagnostics';
import { test, expect } from '../fixtures';

const ids = ['11', '22', '33'].map((byte) => `0x${byte.repeat(32)}`);
const originTx = `0x${'aa'.repeat(32)}`;
const destinationTx = `0x${'bb'.repeat(32)}`;
const pendingDestinationTx = `0x${'dd'.repeat(32)}`;
const revealDestinationTx = `0x${'ee'.repeat(32)}`;
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

async function expectMutedCopy(button: Locator) {
  await expect(button).toHaveClass(/text-foreground-muted/);
  await expect(button.locator('rect')).toHaveCount(2);
  const { color, strokes } = await button.evaluate((element) => ({
    color: getComputedStyle(element).color,
    strokes: Array.from(element.querySelectorAll('rect')).map(
      (rect) => getComputedStyle(rect).stroke,
    ),
  }));
  expect(color).not.toBe('rgb(0, 0, 0)');
  expect(new Set(strokes)).toEqual(new Set([color]));
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
  test(`${kind}: tracks route stages, message delivery, and reloads`, async ({ page }) => {
    test.setTimeout(90_000);
    let reorg = false;
    let originReorg = false;
    let originReceiptRequests = 0;
    let originConfirmed = directBridge;
    let destinationConfirmed = false;
    await page.addInitScript(
      ({
        ids,
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
          persisted.state.isSideBarOpen = true;
          localStorage.setItem('app-state', JSON.stringify(persisted));
          return;
        }
        localStorage.setItem(
          'app-state',
          JSON.stringify({
            version: 6,
            state: {
              chainMetadataOverrides: {
                base: { blocks: { confirmations: 2, reorgPeriod: 15, estimateBlockTime: 2 } },
                bsc: {
                  blocks: {
                    confirmations: 1,
                    reorgPeriod: taggedFinality ? 'finalized' : 5,
                    estimateBlockTime: 1,
                  },
                },
              },
              selectedTransactionId: 'progress-fixture',
              isSideBarOpen: true,
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
    let diagnosticsClosed = 0;
    let relaySequence = 0;
    const sendRelayState = (index: number, state: RelayState, partial = false) =>
      diagnosticsSocket?.send(
        JSON.stringify({
          type: 'diagnostics',
          data: {
            version: 1,
            message_id: ids[index],
            partial,
            activities: [
              {
                id: String(++relaySequence),
                relayer: address,
                version: 1,
                observed_at: '2026-11-06 15:00:00',
                activity: { type: 'snapshot', state },
              },
            ],
          },
        }),
      );
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
        socket.onClose(() => diagnosticsClosed++);
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
            message_view: originReorg
              ? []
              : byOriginTx
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
      if (payload.method === 'eth_getTransactionReceipt' && payload.params?.[0] === originTx)
        originReceiptRequests++;
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
          ? originReorg && payload.params?.[0] === originTx
            ? null
            : receipt
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
      // Unknown IDs cannot receive targeted upserts; discovery uses its normal poll.
      originIndexed = true;
    }

    const progress = page.getByRole('region', { name: 'Transfer progress' });
    await expect(progress).toBeVisible({ timeout: 60_000 });
    await expect(progress.locator('article')).toHaveCount(directBridge ? 1 : 3, {
      timeout: 15_000,
    });
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
    const primary = progress.locator('article').first();
    await expect(primary).toHaveAttribute(
      'aria-label',
      directBridge ? 'Bridge funds' : 'Destination delivery',
    );
    await expect(primary.locator(':scope > .message-disclosure')).toHaveAttribute('open', '');
    await expect(primary.locator('.ism-disclosure')).not.toHaveAttribute('open', '');
    const footer = page.getByTestId('transfer-footer');
    const explorerLink = footer.getByRole('link', { name: 'Track on Hyperlane Explorer' });
    await expect(explorerLink).toBeVisible();
    await expect(explorerLink).toHaveAttribute('href', new RegExp(ids[directBridge ? 0 : 2]));
    await expect(explorerLink).toHaveAttribute('target', '_blank');
    expect(
      await progress.evaluate((element) =>
        Boolean(
          element.compareDocumentPosition(
            document.querySelector('[data-testid="transfer-footer"]')!,
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
    ).toBe(true);
    const destinationLink = page.getByRole('link', {
      name: 'View delivery transaction on block explorer',
    });
    if (directBridge) {
      await expect(destinationLink).toBeVisible();
      await expect(destinationLink).toHaveAttribute('title', pendingDestinationTx);
      await expect(destinationLink).toHaveText('Binance: 0xdddddddd…dddddddd');
      await expect(page.getByTestId('transfer-estimate')).toHaveCount(0);
    } else {
      await expect(progress.locator(':scope > details')).toHaveCount(0);
      await expect(progress.getByText('Other transfer messages (2)', { exact: true })).toHaveCount(
        0,
      );
      for (const [index, label] of ['Commit authorization', 'Bridge funds'].entries()) {
        const row = progress.locator(':scope > article').nth(index + 1);
        await expect(row).toHaveAttribute('aria-label', label);
        await expect(row.locator(':scope > .message-disclosure > summary')).toBeVisible();
        await expect(row.locator(':scope > .message-disclosure')).not.toHaveAttribute('open', '');
      }
      await expect(page.getByTestId('transfer-estimate')).toHaveText('Estimated delivery ~35s');
      await expect(destinationLink).toHaveCount(0);
    }
    const desktopViewport = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await progress.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (swapStages) await expectCompactRoute(stages);
    await page.setViewportSize(desktopViewport);
    if (directBridge) {
      const bridge = progress.getByRole('article', { name: 'Bridge funds' });
      await expect(bridge.getByRole('status')).toHaveText('Delivered');
      await expect(bridge).toContainText(
        taggedFinality
          ? 'Destination confirmations'
          : 'Destination confirmations · 0/5 · ~5s remaining',
      );
      if (taggedFinality) await expect(bridge).not.toContainText('remaining');
      else
        await expect(
          bridge.getByText('Destination confirmations · 0/5 · ~5s remaining', { exact: true }),
        ).toHaveCSS('margin-top', '16px');
      await expect(outcome).toHaveText('Funds are available to use on Binance.');
      await expect(outcome).toHaveClass(/sr-only/);
      await expect(
        page.getByText('Transfer complete! Funds have arrived.', { exact: true }),
      ).toHaveCount(0);
      await expect(bridge).not.toContainText('Funds are available to use');
      await expect(page.getByTestId('transfer-headline')).toHaveText('Transfer complete');
      await expect(page.getByTestId('transfer-motion')).toHaveCount(0);
      const dialog = page.getByTestId('transfer-details');
      await expect(dialog.getByText('Sender Address', { exact: true })).toHaveCount(0);
      await expect(dialog.getByText('Recipient Address', { exact: true })).toHaveCount(0);
      await expect(dialog.getByText('Origin Transaction Hash', { exact: true })).toHaveCount(0);
      await expect(dialog.getByText('Destination Transaction Hash', { exact: true })).toHaveCount(
        0,
      );
      await expect(dialog.getByText('Bridge Message ID', { exact: true })).toHaveCount(0);
      await bridge.locator('.ism-disclosure > summary').click();
      await expect(bridge.getByRole('heading', { name: 'Transaction details' })).toBeVisible();
      await expect(bridge).toContainText(
        taggedFinality ? 'Waiting for finalized block' : '0/5 blocks · ~5s remaining',
      );
      await expect(
        bridge.getByRole('link', { name: 'Sender (opens in new tab)', exact: true }),
      ).toHaveAttribute('title', messageSenders[0]);
      await expect(
        bridge.getByRole('link', { name: 'Recipient (opens in new tab)', exact: true }),
      ).toHaveAttribute('title', messageRecipients[0]);
      const tokenRecipient = bridge.getByRole('link', {
        name: 'Token recipient (opens in new tab)',
        exact: true,
      });
      await expect(tokenRecipient).toHaveAttribute('title', address);
      await expect(tokenRecipient).toHaveAttribute(
        'href',
        `https://bscscan.com/address/${address}`,
      );
      const copyTokenRecipient = bridge.getByRole('button', { name: 'Copy token recipient' });
      await expectMutedCopy(copyTokenRecipient);
      if (kind === 'bridge') {
        const copyDestination = page.getByRole('button', {
          name: 'Copy delivery transaction hash',
        });
        await expectMutedCopy(copyDestination);
        await page.emulateMedia({ colorScheme: 'dark' });
        await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'dark');
        await expectMutedCopy(copyTokenRecipient);
        await expectMutedCopy(copyDestination);
        // Capture the Clipboard API boundary without OS permissions or clipboard side effects.
        await page.evaluate(() => {
          let copied = '';
          Object.defineProperty(navigator.clipboard, 'writeText', {
            value: async (value: string) => {
              copied = value;
            },
          });
          Object.defineProperty(navigator.clipboard, 'readText', { value: async () => copied });
        });
        await copyTokenRecipient.click();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
        await expect
          .poll(() =>
            copyTokenRecipient.evaluate((element) => {
              const checkmark = element.querySelector('path');
              return (
                !!checkmark && getComputedStyle(checkmark).fill === getComputedStyle(element).color
              );
            }),
          )
          .toBe(true);
        await page.emulateMedia({ colorScheme: 'light' });
      }
      await expect(
        bridge.getByRole('link', { name: 'Origin transaction (opens in new tab)' }),
      ).toHaveAttribute('title', originTx);
      await expect(
        bridge.getByRole('link', { name: 'Delivery transaction (opens in new tab)' }),
      ).toHaveAttribute('title', pendingDestinationTx);
      await expect(bridge.getByRole('list', { name: 'Message lifecycle stages' })).toHaveCount(1);
      await expect(bridge.locator('.relay-stages li')).toHaveCount(5);
      await expect(bridge.locator('.relay-stages li[data-reached="true"]')).toHaveCount(4);
      await expect(bridge.getByRole('list', { name: 'Message milestones' })).toHaveCount(0);
      await expect(
        bridge.getByRole('listitem', { name: 'Delivered', exact: true }),
      ).toHaveAttribute('data-reached', 'true');
      const confirmationStage = bridge.getByRole('listitem', { name: 'Confirmed', exact: true });
      await expect(confirmationStage).toHaveAttribute('aria-current', 'step');
      await expect(confirmationStage).toHaveText('Confirming');
      await expect(confirmationStage).toHaveAttribute('data-reached', 'false');
      await page.locator('.transfer-details-modal').evaluate((element) => element.scrollTo(0, 0));
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await progress.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      if (swapStages) await expectCompactRoute(stages);
      await page.reload();
      await expect(outcome).toContainText('Funds are available to use');
      destinationConfirmed = true;
      sendHeads();
      await expect(bridge.getByRole('status')).toHaveText('Confirmed', { timeout: 20_000 });
      await expect(bridge.locator('.relay-stages li[data-reached="true"]')).toHaveCount(5);
      await expect(bridge.locator('.relay-stages [aria-current="step"]')).toHaveCount(0);
      await expect(bridge.locator('.relay-live-dot')).toHaveCSS('animation-name', 'none');
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
      await expect(destinationLink).toHaveCount(0);
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
      await expect(destinationLink).toHaveAttribute('title', destinationTx);
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
      await expect(destinationLink).toHaveCount(0);

      if (kind === 'bridge') {
        // An old persisted inclusion height cannot prove a tx survived an origin reorg.
        const originStage = bridge.getByRole('listitem', {
          name: 'Origin confirmed',
          exact: true,
        });
        for (const reconnect of [false, true]) {
          originReorg = true;
          const beforeSnapshot = snapshotRequests;
          const beforeOriginReceipt = originReceiptRequests;
          if (reconnect) liveSocket?.close();
          else liveSocket?.send(JSON.stringify({ type: 'rollback', domain: 8453, toHeight: '99' }));
          await expect.poll(() => snapshotRequests).toBeGreaterThan(beforeSnapshot);
          await expect.poll(() => originReceiptRequests).toBeGreaterThan(beforeOriginReceipt);
          liveSocket?.send(JSON.stringify({ type: 'block', domain: 8453, headHeight: '120' }));
          await expect(originStage).toHaveAttribute('data-reached', 'false');
          await expect(bridge.getByRole('status')).toHaveText('Confirming origin');
          originReorg = false;
          liveSocket?.send(JSON.stringify({ type: 'message_upsert', data: entry(0) }));
          await expect(originStage).toHaveAttribute('data-reached', 'true');
        }
      }

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
    const reveal = progress.getByRole('article', { name: 'Destination delivery' });
    const bridge = progress.locator('article').filter({ hasText: 'Bridge funds' });
    const commit = progress.locator('article').filter({ hasText: 'Commit authorization' });
    await expect(reveal.getByRole('status')).toHaveText('Confirming origin');
    await expect(reveal).toContainText('Origin confirmations · 0/15 · ~30s remaining');
    await expect(
      reveal.getByText('Origin confirmations · 0/15 · ~30s remaining', { exact: true }),
    ).toHaveCSS('margin-top', '16px');
    await expect(reveal).not.toContainText('Destination confirmations');
    const originStage = reveal.getByRole('listitem', { name: 'Origin confirmed', exact: true });
    const verificationStage = reveal.getByRole('listitem', {
      name: 'Validated',
      exact: true,
    });
    await expect(originStage).toHaveAttribute('aria-current', 'step');
    await expect(originStage).toHaveText('Confirming origin');
    await expect(originStage).toHaveAttribute('data-reached', 'false');
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
    await expect(reveal.getByRole('listitem').first().locator(':scope > span').first()).toHaveCSS(
      'height',
      '3px',
    );
    await expect(reveal.getByRole('list', { name: 'Message lifecycle stages' })).toBeVisible();
    await reveal.locator('.ism-disclosure > summary').click();
    await expect(reveal.getByRole('heading', { name: 'Transaction details' })).toBeVisible();
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
    await expect(reveal.getByRole('status')).toHaveText('Confirming origin');
    await expect(reveal).toContainText('Origin confirmations · 1/15 · ~28s remaining');
    await expect(reveal).toContainText('1/15 blocks');
    if (kind === 'both') {
      await reveal.locator(':scope > .message-disclosure > summary').click();
      await expect(reveal.getByTitle('Estimated time to delivery', { exact: true })).toHaveText(
        '~33s',
      );
      await reveal.locator(':scope > .message-disclosure > summary').click();
      sendRelayState(2, { phase: 'preparing', modules: [] });
      await expect(reveal.locator('.relay-live-status')).toHaveAttribute('data-live', 'true');
      await expect(reveal.getByRole('status')).toHaveText('Confirming origin');
      await expect(originStage).toHaveAttribute('aria-current', 'step');
      await expect(verificationStage).not.toHaveAttribute('aria-current', 'step');
    }
    originConfirmed = true;
    sendHeads();
    await expect(originStage).toHaveAttribute('data-reached', 'true');
    await expect(verificationStage).toHaveAttribute('aria-current', 'step');
    await expect(verificationStage).toHaveText('Validating');
    await expect(reveal.getByRole('status')).toHaveText('Validating');
    if (kind === 'both') {
      await expect(reveal.getByRole('status')).toHaveText('Validating');
      const verificationSpinner = verificationStage.locator('.message-status-spinner');
      await expect(verificationSpinner).toBeVisible();
      await expect(verificationSpinner).not.toHaveCSS('animation-name', 'none');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(verificationSpinner).toHaveCSS('animation-name', 'none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      diagnosticsSocket?.send(
        JSON.stringify({ type: 'diagnostics_unavailable', message_ids: [ids[2]] }),
      );
      await expect(reveal.locator('.relay-live-status')).toHaveText('Updates unavailable');
      await expect(verificationStage).toHaveAttribute('aria-current', 'step');
      await expect(reveal.getByRole('status')).toHaveText('Validating');
      await expect(verificationSpinner).toBeVisible();
    }
    await expect(bridge.getByRole('status')).toHaveText('Confirmed');
    await expect(commit.getByRole('status')).toHaveText('Confirming destination · 0/5');
    await commit.locator(':scope > .message-disclosure > summary').click();
    await expect(commit).toContainText('Destination confirmations · 0/5 · ~5s remaining');
    await expect(commit.getByRole('listitem', { name: 'Delivered', exact: true })).toHaveAttribute(
      'data-reached',
      'true',
    );
    await expect(commit.locator('.relay-stages li[data-reached="true"]')).toHaveCount(4);
    await expect(commit.getByRole('listitem', { name: 'Confirmed', exact: true })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await commit.locator('.ism-disclosure > summary').click();
    await expect(commit.getByRole('heading', { name: 'Transaction details' })).toBeVisible();
    await expect(commit).toContainText('0/5 blocks · ~5s remaining');
    await expect(reveal.getByRole('status')).toHaveText('Validating', { timeout: 20_000 });
    await expect(reveal.getByRole('listitem', { name: 'Delivered', exact: true })).toHaveAttribute(
      'data-reached',
      'false',
    );
    await expect(reveal.getByRole('listitem', { name: 'Confirmed', exact: true })).toHaveAttribute(
      'data-reached',
      'false',
    );
    await reveal.locator(':scope > .message-disclosure > summary').click();
    await commit.locator(':scope > .message-disclosure > summary').click();
    await expect(page.getByTestId('transfer-headline')).toHaveText('Transfer in progress');
    await expect(page.getByTestId('transfer-motion')).toHaveCount(0);
    await expect(reveal.getByTitle('Estimated time to delivery', { exact: true })).toHaveText(
      '~5s',
    );
    await expect(
      commit.getByTitle('Estimated time to destination confirmation', { exact: true }),
    ).toHaveText('~5s');
    await expect(bridge.locator('summary [title^="Estimated time"]')).toHaveCount(0);
    for (const row of await progress.locator('article').all()) {
      await expect(row.locator('summary .relay-stages')).toHaveCount(0);
      expect(
        await row.evaluate((element) => {
          const estimate = element.querySelector('summary [title^="Estimated time"]');
          if (!estimate) return true;
          const estimateBox = estimate.getBoundingClientRect();
          const statusBox = element.querySelector('summary output')!.getBoundingClientRect();
          return (
            estimateBox.left >= statusBox.right &&
            estimateBox.right <= element.getBoundingClientRect().right
          );
        }),
      ).toBe(true);
      const box = await row.boundingBox();
      expect(box?.height).toBeLessThanOrEqual(60);
    }
    await page.locator('.transfer-details-modal').evaluate((element) => element.scrollTo(0, 0));
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(progress).toBeVisible();
    expect(await progress.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (swapStages) await expectCompactRoute(stages);
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
    await expectMutedCopy(reveal.getByRole('button', { name: 'Copy message id' }));
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'dark');
    await expect(page.getByTestId('transfer-headline')).toHaveCSS('color', 'rgb(242, 228, 255)');
    await expectMutedCopy(reveal.getByRole('button', { name: 'Copy message id' }));
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
    await expect(bridge.getByRole('listitem', { name: 'Delivered', exact: true })).toHaveAttribute(
      'data-reached',
      'false',
    );

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
        partial = false,
      ) =>
        sendRelayState(
          index,
          relayState ?? {
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
          partial,
        );
      if ((await row.locator(':scope > .message-disclosure').getAttribute('open')) === null)
        await row.locator(':scope > .message-disclosure > summary').click();
      if ((await row.locator('.ism-disclosure').getAttribute('open')) === null)
        await row.locator('.ism-disclosure > summary').click();
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
        await expect(row.getByRole('status')).toHaveText('Validating');
        const verification = row.getByRole('listitem', { name: 'Validated', exact: true });
        await expect(verification).toHaveAttribute('aria-current', 'step');
        await expect(verification).toHaveText('Validating');
        expect(
          await verification.evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
        await expect(routing.locator('.ism-status-label')).toHaveText('Waiting');
        await expect(row.locator('.ism-node[data-state="waiting"]')).toHaveCount(2);
        const delivering = row.getByRole('listitem', { name: 'Delivered', exact: true });
        await expect(row.getByRole('listitem', { name: 'Submitted', exact: true })).toHaveCount(0);
        sendProof(null, null, {
          ...candidate,
          phase: 'retrying',
          submission: { stage: 'mempool' },
        });
        await expect(row.locator('.ism-node[data-state="failed"]')).toHaveCount(2);
        await expect(verification).toHaveAttribute('aria-current', 'step');
        await expect(verification).toHaveText('Validating');
        await expect(delivering).toHaveAttribute('data-reached', 'false');
        await expect(delivering).not.toHaveAttribute('aria-current', 'step');
        // Reveal simulation can fail while the commit message is still arriving.
        // Pausing an unfinished step must never give it its completed label.
        const simulationFailure = { stage: 'simulate', reason: 'contract_call_failed' };
        sendProof(null, null, { ...candidate, failure: simulationFailure });
        await expect(verification).toHaveText('Validating');
        await expect(verification).toHaveAttribute('data-reached', 'false');
        await expect(verification).not.toHaveAttribute('aria-current', 'step');
        await expect(verification.locator('.message-status-spinner')).toHaveCount(0);
        await expect(row.locator('.message-status-spinner')).toHaveCount(0);
        const awaitingCommit: RelayState = {
          ...candidate,
          phase: 'retrying',
          failure: simulationFailure,
          retry: { reason: 'AwaitingIcaReveal', count: 0 },
        };
        // A different simulation error remains a real failure, even with this retry reason.
        sendProof(null, null, {
          ...awaitingCommit,
          failure: { stage: 'simulate', reason: 'rpc_timeout' },
        });
        await expect(row.getByRole('status')).toHaveText('Waiting for relay update');
        await expect(verification).toHaveText('Validating');
        await expect(verification).not.toHaveAttribute('aria-current', 'step');
        await expect(verification.locator('.message-status-spinner')).toHaveCount(0);
        for (const nextAttempt of [1_794_049_769_832, 1_794_049_771_010]) {
          sendProof(null, null, {
            ...awaitingCommit,
            retry: { ...awaitingCommit.retry!, next_attempt_at_millis: nextAttempt },
          });
          await expect(row.getByRole('status')).toHaveText('Waiting for commit confirmation');
          await expect(verification).toHaveText('Validating');
          await expect(verification).toHaveAttribute('data-reached', 'false');
          await expect(verification).toHaveAttribute('aria-current', 'step');
          await expect(verification.locator('.message-status-spinner')).toBeVisible();
          await expect(
            row.locator(':scope > .message-disclosure > summary .message-status-spinner'),
          ).toBeVisible();
          await expect(row.locator('.ism-disclosure')).toContainText('contract call failed');
        }
        const ready = {
          ...candidate,
          phase: 'ready_to_submit',
          modules: [
            { ...candidate.modules[0], selected_children: ['other'], verified: 1 },
            ...candidate.modules.slice(1),
          ],
        };
        sendProof(null, null, ready);
        await expect(routing.locator('.ism-status-label')).toHaveText('Unused');
        await expect(row.locator('.ism-node[data-state="unused"]')).toHaveCount(2);
        await expect(verification).toHaveAttribute('data-reached', 'true');
        await expect(delivering).toHaveAttribute('aria-current', 'step');
        await expect(delivering).toHaveAttribute('data-reached', 'false');
        await expect(delivering).toHaveText('Delivering');
        await expect(row.getByRole('status')).toHaveText('Validated · Preparing submission');
        // Missing or older diagnostics must not undo the selected reporter's progress.
        for (const activities of [
          [],
          [
            {
              id: '0',
              relayer: address,
              version: 1,
              observed_at: '2026-11-06 14:59:00',
              activity: { type: 'snapshot', state: candidate },
            },
          ],
        ]) {
          diagnosticsSocket?.send(
            JSON.stringify({
              type: 'diagnostics',
              data: { version: 1, message_id: ids[2], partial: !activities.length, activities },
            }),
          );
          await expect(row.getByText('Partial data', { exact: true })).toBeVisible();
          await expect(verification).toHaveAttribute('data-reached', 'true');
          await expect(delivering).toHaveAttribute('aria-current', 'step');
          await expect(row.getByRole('status')).toHaveText('Validated · Preparing submission');
          sendProof(null, null, ready);
          await expect(row.getByText('Partial data', { exact: true })).toHaveCount(0);
        }
        // Closing stops diagnostics but keeps the same lifecycle and disclosure nodes.
        await verification.evaluate((element) => element.setAttribute('data-preserved', 'true'));
        const rootDetails = row.locator('.ism-node').first();
        await rootDetails.locator(':scope > summary').click();
        await expect(rootDetails).toHaveAttribute('open', '');
        const beforeClose = diagnosticsClosed;
        await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
        await expect(page.getByRole('dialog')).not.toBeVisible();
        await expect.poll(() => diagnosticsClosed).toBeGreaterThan(beforeClose);
        await page.locator('.sidebar-menu-list button').first().click();
        await expect(row).toBeVisible();
        await expect(verification).toHaveAttribute('data-preserved', 'true');
        await expect(verification).toHaveAttribute('data-reached', 'true');
        await expect(row.getByRole('status')).toHaveText('Validated · Preparing submission');
        await expect(row.locator('.ism-disclosure')).toHaveAttribute('open', '');
        await expect(rootDetails).toHaveAttribute('open', '');
        await rootDetails.locator(':scope > summary').click();
        sendProof(null, null, ready, true);
        await expect(row.getByText('Partial data', { exact: true })).toBeVisible();
        await expect(delivering).toHaveAttribute('aria-current', 'step');
        diagnosticsSocket?.send(
          JSON.stringify({ type: 'diagnostics_unavailable', message_ids: [ids[2]] }),
        );
        await expect(row.locator('.relay-live-status')).toHaveText('Updates unavailable');
        await expect(delivering).toHaveAttribute('aria-current', 'step');
        sendProof(null, null, { ...ready, failure: { reason: 'Submission failed' } });
        await expect(row.locator('.relay-stages [aria-current="step"]')).toHaveCount(0);
        await expect(row.getByRole('status')).toHaveText('Waiting for relay update');
        await row.locator(':scope > .message-disclosure > summary').click();
        await expect(row.locator('summary [title^="Estimated time"]')).toHaveCount(0);
        await row.locator(':scope > .message-disclosure > summary').click();
        sendProof(null, null, {
          ...ready,
          phase: 'submitting',
          submission: { stage: 'submitting' },
        });
        await expect(delivering).toHaveText('Delivering');
        await expect(delivering).toHaveAttribute('aria-current', 'step');
        expect(
          await delivering.evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
        await expect(row.getByRole('status')).toHaveText('Submitting transaction');
        for (const stage of ['submitted', 'mempool']) {
          sendProof(null, null, { ...ready, phase: 'submitting', submission: { stage } });
          await expect(delivering).toHaveAttribute('aria-current', 'step');
          await expect(delivering).toHaveText('Delivering');
          await expect(delivering).toHaveAttribute('data-reached', 'false');
        }
        for (const phase of ['confirming', 'delivered']) {
          sendProof(null, null, { ...ready, phase, submission: { stage: 'included' } });
          await expect(delivering).toHaveAttribute('aria-current', 'step');
          await expect(delivering).toHaveText('Delivering');
          await expect(delivering).toHaveAttribute('data-reached', 'false');
        }
        expect(
          await delivering.evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
      }
      sendProof('succeeded', null);
    }
    for (const [index, row] of [bridge, commit, reveal].entries()) {
      await expect(row.getByRole('list', { name: 'ISM verification tree' })).toBeVisible();
      await expect(row.locator('.ism-node > summary')).toContainText(labels[index]);
      await expect(row.locator('.ism-status-label')).toHaveText('Passed');
      await expect(row.getByRole('list', { name: 'Message milestones' })).toHaveCount(0);
      if (kind === 'both' && index === 0) {
        await row.locator('.ism-node > summary').click();
        await expectMutedCopy(row.getByRole('button', { name: 'Copy ISM address' }));
        await row.locator('.ism-node > summary').click();
      }
    }
    await expect(destinationLink).toHaveCount(0);
    liveSocket?.send(
      JSON.stringify({
        type: 'message_upsert',
        data: {
          ...entry(2),
          is_delivered: true,
          destination_tx_hash: revealDestinationTx,
          destination_block_height: '100',
        },
      }),
    );
    await expect(destinationLink).toHaveAttribute('title', revealDestinationTx);
    await expect(destinationLink).toHaveAttribute('href', new RegExp(revealDestinationTx));
    await expect(page.getByTestId('transfer-estimate')).toHaveCount(0);
    await expect(reveal.getByRole('status')).toHaveText('Confirming destination');
    await expect(reveal.locator('.relay-stages li[data-reached="true"]')).toHaveCount(4);
    await expect(reveal.getByRole('listitem', { name: 'Confirmed', exact: true })).toHaveAttribute(
      'aria-current',
      'step',
    );
    destinationConfirmed = true;
    sendHeads();
    await expect(reveal.getByRole('status')).toHaveText('Confirmed');
    await expect(reveal.locator('.relay-stages li[data-reached="true"]')).toHaveCount(5);
    await expect(reveal.locator('.relay-stages [aria-current="step"]')).toHaveCount(0);
    await expect(reveal.locator('.message-status-spinner')).toHaveCount(0);
    await expect(reveal.locator('.relay-live-dot')).toHaveCSS('animation-name', 'none');
    await expect(reveal).toContainText('Destination confirmations');
    if (kind === 'both') {
      // A stored route without a destination swap highlights bridge value delivery,
      // even when historical commit/reveal messages remain on the transfer.
      await page.evaluate(() => {
        const persisted = JSON.parse(localStorage.getItem('app-state')!);
        const transfer = persisted.state.transactionHistory[0].data;
        transfer.routeSteps = transfer.routeSteps.filter(
          (step: { type: string; chain: number }) =>
            step.type !== 'swap' || step.chain !== transfer.dstChain,
        );
        delete transfer.destinationOutcome;
        localStorage.setItem('app-state', JSON.stringify(persisted));
      });
      reorg = false;
      await page.reload();
      await expect(progress.locator('article')).toHaveCount(3);
      await expect(progress.locator('article').first()).toHaveAttribute(
        'aria-label',
        'Destination delivery',
      );
      await expect(reveal.locator(':scope > .message-disclosure')).toHaveAttribute('open', '');
      await expect(commit.locator(':scope > .message-disclosure')).not.toHaveAttribute('open', '');
      await expect(bridge.locator(':scope > .message-disclosure')).not.toHaveAttribute('open', '');
      await expect(explorerLink).toHaveAttribute('href', new RegExp(ids[0]));
      await expect(page.getByTestId('destination-transaction')).toHaveCount(1);
      await expect(destinationLink).toHaveAttribute('title', destinationTx);
    }
  });
}
