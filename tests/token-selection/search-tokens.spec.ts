import { test, expect } from '@playwright/test';

test.describe('Token Selection - Search Tokens', () => {
  test('should search tokens by name', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open origin token selector
    await page.getByRole('button', { name: 'ethereum HYPER Ethereum' }).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    // Type in token search
    await page.getByPlaceholder('Search Name, Symbol, or Contract Address').fill('ETH');

    // Should show ETH tokens in the list
    await expect(page.getByText('ETH').first()).toBeVisible();
  });
});
