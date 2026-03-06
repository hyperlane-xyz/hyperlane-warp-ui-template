import { test, expect } from '@playwright/test';
import { getOriginTokenButton } from '../helpers/locators';

test.describe('Token Selection - Select Origin Token', () => {
  test('should select a different origin token', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open origin token selector
    await getOriginTokenButton(page).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    // Click on USDC Arbitrum token (exact name to avoid matching 'Route unavailable' variant)
    await page.getByRole('button', { name: 'arbitrum USDC Arbitrum USD Coin', exact: true }).click();

    // Modal should close
    await expect(page.getByText('Select Token')).not.toBeVisible();

    // Origin token should now show USDC on Arbitrum
    await expect(page.getByRole('button', { name: /USDC Arbitrum/i })).toBeVisible();
  });
});
