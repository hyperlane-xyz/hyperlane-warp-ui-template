import { test, expect } from '@playwright/test';

test.describe('Transfer Form - Swap Tokens', () => {
  test('should swap origin and destination tokens', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Verify initial state
    await expect(page.getByRole('button', { name: 'ethereum HYPER Ethereum' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'bsc HYPER Binance Smart Chain' })).toBeVisible();

    // Click swap button (between Send and Receive sections)
    await page.locator('div.-my-3 > button').click();

    // After swap: origin should be BSC, destination should be Ethereum
    await expect(page.getByRole('button', { name: /bsc HYPER/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /ethereum HYPER/i }).first()).toBeVisible();
  });
});
