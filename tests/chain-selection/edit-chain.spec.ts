import { test, expect } from '@playwright/test';

import { getOriginTokenButton } from '../helpers/locators';
import { installRouterApiMock } from '../helpers/routerApi';

test.describe('Chain Selection - Edit Chain', () => {
  test.beforeEach(async ({ page }) => {
    await installRouterApiMock(page);
  });

  test('should exit edit mode', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();

    // Enter edit mode
    await page.getByRole('button', { name: 'Edit chain metadata' }).click();
    await expect(page.getByRole('button', { name: 'Exit edit mode' })).toBeVisible();

    // Exit edit mode
    await page.getByRole('button', { name: 'Exit edit mode' }).click();

    // Should show "Edit chain metadata" again
    await expect(page.getByRole('button', { name: 'Edit chain metadata' })).toBeVisible();
  });

  test('should open chain details when selecting a chain in edit mode', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();
    await page.getByRole('button', { name: 'Edit chain metadata' }).click();
    await page.locator('.token-picker-chain-row[data-chain="bsc"]').click();

    await expect(page.locator('.chain-edit-container')).toBeVisible();
    await expect(page.getByText('Edit Binance Smart Chain')).toBeVisible();
  });
});
