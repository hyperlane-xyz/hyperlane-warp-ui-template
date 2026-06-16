import { test, expect } from '@playwright/test';
import { waitForTransferForm } from '../helpers/locators';

test.describe('Transfer Form - Connect Wallet Prompt', () => {
  test('should show connect wallet button when not connected', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await waitForTransferForm(page);

    // Main connect wallet submit button at bottom of form
    const connectButton = page.getByRole('main').getByRole('button', { name: 'Connect wallet', exact: true });
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
  });
});
