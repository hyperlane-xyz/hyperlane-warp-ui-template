import { test, expect } from '@playwright/test';

test.describe('Sidebar', () => {
  test('should show sidebar with wallet and history sections', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Connected Wallets section
    await expect(page.getByText('Connected Wallets')).toBeVisible();

    // Transfer History section
    await expect(page.getByText('Transfer History')).toBeVisible();
    await expect(page.getByText('No transfers yet')).toBeVisible();

    // Sidebar buttons
    await expect(page.getByRole('button', { name: 'Connect wallet' }).nth(1)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disconnect all wallets' })).toBeVisible();
  });
});
