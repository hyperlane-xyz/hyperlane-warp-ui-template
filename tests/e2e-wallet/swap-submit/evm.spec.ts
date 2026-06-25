import { expect, type Page, type Route, test } from '@playwright/test';

import { MOCK_EVM_ADDRESS } from '../helpers/constants';
import { installEvmRpcMock } from '../helpers/evmRpc';
import { enterAmount } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

const BSC_CHAIN_ID = 56;
const SOURCE_TOKEN = '0x1111111111111111111111111111111111111111';
const DESTINATION_TOKEN = '0x2222222222222222222222222222222222222222';
const UNIVERSAL_ROUTER = '0x3333333333333333333333333333333333333333';
const SWAP_TX_SELECTOR = '0x12345678';

test.describe('EVM swap submit', () => {
  test.setTimeout(180_000);

  test('same-chain swap sends the quoted Universal Router tx', async ({ page }) => {
    const quoteRequests: unknown[] = [];
    const { txs } = await installEvmRpcMock(page, {
      chainUrlMap: [{ chainId: BSC_CHAIN_ID, urlMatch: /.*/ }],
      erc20: {
        [`${BSC_CHAIN_ID}:${SOURCE_TOKEN}`]: {
          decimals: 18,
          balances: { [MOCK_EVM_ADDRESS.toLowerCase()]: '0x3635c9adc5dea00000' }, // 1000 SRC
        },
        [`${BSC_CHAIN_ID}:${DESTINATION_TOKEN}`]: {
          decimals: 18,
        },
      },
    });
    await installRouterApiMock(page, quoteRequests);

    await openE2EApp(page, {
      extraQuery: {
        origin: 'bsc',
        originToken: SOURCE_TOKEN,
        destination: 'bsc',
        destinationToken: DESTINATION_TOKEN,
      },
    });
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Route: swap')).toBeVisible({ timeout: 20_000 });

    await enterAmount(page, '1');
    await expect.poll(() => quoteRequests.length, { timeout: 20_000 }).toBeGreaterThan(0);

    await page.getByRole('button', { name: /^Send$/ }).click();

    await expect.poll(() => txs.length, { timeout: 60_000, intervals: [500] }).toBeGreaterThan(0);

    const captured = txs[txs.length - 1];
    expect(captured.chainId).toBe(BSC_CHAIN_ID);
    expect(captured.to?.toLowerCase()).toBe(UNIVERSAL_ROUTER);
    expect(captured.value).toMatch(/^0x?0$/);
    expect(captured.data?.slice(0, 10).toLowerCase()).toBe(SWAP_TX_SELECTOR);
  });
});

async function installRouterApiMock(page: Page, quoteRequests: unknown[]): Promise<void> {
  await page.route(/.*\/(readyz|v1\/chains|v1\/tokens|v1\/quote).*/, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/readyz') {
      return fulfillJson(route, {
        ok: true,
        graphReady: true,
        graphConnections: 1,
        coreConfigChains: 1,
        chainCacheHydrated: true,
        lastRouteCacheRefreshAt: new Date().toISOString(),
        lastRouteCacheRefreshStatus: 'ok',
      });
    }

    if (url.pathname === '/v1/chains') {
      return fulfillJson(route, { chains: [BSC_CHAIN] });
    }

    if (url.pathname === '/v1/tokens') {
      return fulfillJson(route, { tokens: TOKENS });
    }

    if (url.pathname === '/v1/quote') {
      quoteRequests.push(request.postDataJSON());
      return fulfillJson(route, {
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        routes: [
          {
            steps: [
              {
                type: 'swap',
                chain: BSC_CHAIN_ID,
                dex: 'mockdex',
                tokenIn: SOURCE_TOKEN,
                tokenOut: DESTINATION_TOKEN,
                amountIn: '1000000000000000000',
                amountOut: '990000000000000000',
                path: [SOURCE_TOKEN, DESTINATION_TOKEN],
                poolCount: 1,
                minPoolTvlUsd: null,
              },
            ],
            output: '990000000000000000',
            outputMin: '980000000000000000',
            connection: null,
            gas: {
              originGas: '100000',
              destGas: '0',
            },
            tx: {
              to: UNIVERSAL_ROUTER,
              data: `${SWAP_TX_SELECTOR}${'00'.repeat(32)}`,
              value: '0',
            },
          },
        ],
      });
    }

    return route.continue();
  });
}

function fulfillJson(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

const BSC_CHAIN = {
  id: BSC_CHAIN_ID,
  name: 'BSC',
  chainName: 'bsc',
  displayName: 'BSC',
  protocol: 'ethereum',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  universalRouter: UNIVERSAL_ROUTER,
  permit2: '0x4444444444444444444444444444444444444444',
  dex: 'mockdex',
  canSwap: true,
  canExecute: true,
  supportsNative: true,
};

const TOKENS = [
  {
    chainId: BSC_CHAIN_ID,
    address: SOURCE_TOKEN,
    symbol: 'SRC',
    name: 'Source Token',
    decimals: 18,
    isNative: false,
    isBridgeToken: false,
    isPoolToken: true,
    canBridge: false,
    canSwap: true,
    bridgeSymbols: [],
    warpRouteIds: [],
  },
  {
    chainId: BSC_CHAIN_ID,
    address: DESTINATION_TOKEN,
    symbol: 'DST',
    name: 'Destination Token',
    decimals: 18,
    isNative: false,
    isBridgeToken: false,
    isPoolToken: true,
    canBridge: false,
    canSwap: true,
    bridgeSymbols: [],
    warpRouteIds: [],
  },
];
