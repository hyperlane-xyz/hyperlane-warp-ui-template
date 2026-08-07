import type { Page, Route } from '@playwright/test';

const ZERO = '0x0000000000000000000000000000000000000000';
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const UNIVERSAL_ROUTER = '0x1111111111111111111111111111111111111111';

const chains = [
  {
    id: 56,
    name: 'BNB Smart Chain',
    chainName: 'bsc',
    displayName: 'BNB Smart Chain',
    protocol: 'ethereum',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    universalRouter: UNIVERSAL_ROUTER,
    permit2: PERMIT2,
    dex: null,
    canSwap: true,
    canExecute: true,
    supportsNative: true,
  },
  {
    id: 8453,
    name: 'Base',
    chainName: 'base',
    displayName: 'Base',
    protocol: 'ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    universalRouter: UNIVERSAL_ROUTER,
    permit2: PERMIT2,
    dex: null,
    canSwap: true,
    canExecute: true,
    supportsNative: true,
  },
];

const tokens = [
  {
    chainId: 56,
    address: ZERO,
    symbol: 'BNB',
    name: 'BNB',
    decimals: 18,
    isNative: true,
    isBridgeToken: true,
    isPoolToken: false,
    canBridge: true,
    canSwap: true,
    bridgeSymbols: ['BNB'],
    warpRouteIds: ['BNB/test'],
  },
  {
    chainId: 8453,
    address: ZERO,
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    isNative: true,
    isBridgeToken: true,
    isPoolToken: false,
    canBridge: true,
    canSwap: true,
    bridgeSymbols: ['ETH'],
    warpRouteIds: ['ETH/test'],
  },
];

export async function installRouterApiMock(page: Page): Promise<void> {
  await page.route('**/readyz', async (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        graphReady: true,
        graphConnections: 1,
        coreConfigChains: chains.length,
        chainCacheHydrated: true,
        lastRouteCacheRefreshAt: new Date().toISOString(),
        lastRouteCacheRefreshStatus: 'ok',
      }),
    }),
  );

  await page.route('**/v1/chains', async (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ chains }),
    }),
  );

  await page.route('**/v1/tokens**', async (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tokens }),
    }),
  );

  await page.route('**/v1/available-routes**', async (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ direction: 'fromSource', tokens }),
    }),
  );
}
