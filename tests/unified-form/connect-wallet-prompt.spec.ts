import { test, expect } from '@playwright/test';
import { waitForUnifiedForm } from '../helpers/locators';

test.describe('Unified Form - Connect Wallet Prompt', () => {
  test('should show connect wallet button when not connected', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await waitForUnifiedForm(page);

    const connectButton = page
      .getByRole('main')
      .getByRole('button', { name: 'Connect wallet', exact: true });
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
  });
});
