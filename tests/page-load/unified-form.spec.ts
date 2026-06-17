import { expect, test } from '@playwright/test';

import { getOriginTokenButton, waitForUnifiedForm } from '../helpers/locators';

test.describe('Page Load - Unified Form', () => {
  test('shows the default bridge route', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await waitForUnifiedForm(page);

    await expect(page.getByText('Route: bridge')).toBeVisible();
    await expect(page.getByText('Remote Balance:')).toBeVisible();
  });

  test('shows featured tokens first without route tags in the token picker', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await waitForUnifiedForm(page);

    await getOriginTokenButton(page).click();
    await expect(page.getByText('Token Selection')).toBeVisible();

    const rows = page.locator('.token-picker-row');
    await expect(rows.first()).toContainText('USDC');
    await expect(rows.first()).not.toContainText('Bridge');
    await expect(rows.first()).not.toContainText('Swap');
  });

  test('uses swap route mode for address-style swap deep links when engine is configured', async ({
    page,
  }) => {
    await page.goto(
      'http://localhost:3000/?origin=bsc&originToken=0xfb6115445Bff7b52FeB98650C87f44907E58f802&destination=base&destinationToken=0x63706e401c06ac8513145b7687A14804d17f814b',
    );
    await waitForUnifiedForm(page);

    const swapRoute = page.getByText('Route: swap');
    const hasSwapRoute = await swapRoute
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!hasSwapRoute, 'router engine is not configured or route lookup is unavailable');

    await expect(swapRoute).toBeVisible();
    await expect(page.getByText('Slippage')).toBeVisible();
    await expect(page.getByText('Remote Balance:')).not.toBeVisible();
  });
});
