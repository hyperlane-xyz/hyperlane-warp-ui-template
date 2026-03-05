import { test, expect } from '@playwright/test';

test.describe('Token Selection - Select Destination Token', () => {
  test('should select a different destination token', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open destination token selector
    await page.getByRole('button', { name: 'bsc HYPER Binance Smart Chain' }).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    // Click on HYPER Arbitrum token
    await page.getByRole('button', { name: 'HYPER Arbitrum Hyperlane' }).click();

    // Modal should close
    await expect(page.getByText('Select Token')).not.toBeVisible();

    // Destination token should now show HYPER on Arbitrum
    await expect(page.getByRole('button', { name: /HYPER Arbitrum/i })).toBeVisible();
  });
});
