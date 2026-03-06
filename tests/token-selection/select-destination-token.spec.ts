import { test, expect } from '@playwright/test';
import { getDestinationTokenButton } from '../helpers/locators';

test.describe('Token Selection - Select Destination Token', () => {
  test('should select a different destination token', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open destination token selector
    await getDestinationTokenButton(page).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    // Click on USDC Arbitrum token
    await page.getByRole('button', { name: 'arbitrum USDC Arbitrum USD Coin' }).first().click();

    // Modal should close
    await expect(page.getByText('Select Token')).not.toBeVisible();

    // Destination token should now show USDC on Arbitrum
    await expect(page.getByRole('button', { name: /USDC Arbitrum/i })).toBeVisible();
  });
});
