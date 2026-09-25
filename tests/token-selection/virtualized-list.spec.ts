import { expect, test } from '@playwright/test';

import { getOriginTokenButton } from '../helpers/locators';
import { installRouterApiMock } from '../helpers/routerApi';

const manyTokens = Array.from({ length: 200 }, (_, index) => ({
  chainId: 8453,
  address: `0x${(index + 1).toString(16).padStart(40, '0')}`,
  symbol: `TOK${index.toString().padStart(3, '0')}`,
  name: `Token ${index.toString().padStart(3, '0')}`,
  decimals: 18,
  isNative: false,
  isBridgeToken: false,
  isPoolToken: true,
  canBridge: false,
  canSwap: true,
  bridgeSymbols: [],
  warpRouteIds: [],
}));

test.describe('Token Selection - Virtualized List', () => {
  test('renders a small window while every token remains scrollable', async ({ page }) => {
    await installRouterApiMock(page);
    await page.route('**/v1/tokens**', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tokens: manyTokens }),
      }),
    );

    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });
    await getOriginTokenButton(page).click();

    const scroller = page.locator('.token-picker-scroll');
    const rows = page.locator('.token-picker-row');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeLessThan(20);
    await expect(page.locator('.token-picker-hint')).toHaveCount(0);

    await scroller.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect(rows.filter({ hasText: 'TOK199' })).toBeVisible();
    expect(await rows.count()).toBeLessThan(20);
  });
});
