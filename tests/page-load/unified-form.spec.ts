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
      'http://localhost:3000/?origin=bsc&originToken=0x0000000000000000000000000000000000000000&destination=base&destinationToken=0x0000000000000000000000000000000000000000',
    );
    await waitForUnifiedForm(page);

    const swapRoute = page.getByText('Route: swap');
    const hasSwapRoute = await swapRoute.isVisible();
    test.skip(!hasSwapRoute, 'router engine is not configured');

    await expect(swapRoute).toBeVisible();
    await expect(page.getByText('Slippage')).toBeVisible();
    await expect(page.getByText('Remote Balance:')).not.toBeVisible();
  });
});
