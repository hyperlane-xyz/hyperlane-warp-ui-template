import { test, expect } from '@playwright/test';

test.describe('Token Selection - Select Origin Token', () => {
  test('should select a different origin token', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open origin token selector
    await page.getByRole('button', { name: 'ethereum HYPER Ethereum' }).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    // Click on HYPER Base token
    await page.getByRole('button', { name: 'HYPER Base Hyperlane' }).click();

    // Modal should close
    await expect(page.getByText('Select Token')).not.toBeVisible();

    // Origin token should now show HYPER on Base
    await expect(page.getByRole('button', { name: /HYPER Base/i })).toBeVisible();
  });
});
