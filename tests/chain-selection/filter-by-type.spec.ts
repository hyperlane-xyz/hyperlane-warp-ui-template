import { test, expect } from '@playwright/test';

test.describe('Chain Selection - Filter by Type', () => {
  test('should filter chains by Testnet type', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open token selector
    await page.getByRole('button', { name: 'ethereum HYPER Ethereum' }).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    // Open filter dropdown
    await page.getByRole('button', { name: 'Filter chains' }).click();

    // Verify filter panel shows
    await expect(page.getByText('Filters')).toBeVisible();
    await expect(page.getByText('Type')).toBeVisible();
    await expect(page.getByText('Protocol', { exact: true })).toBeVisible();

    // Click Testnet filter
    await page.getByRole('button', { name: 'Testnet', exact: true }).click();

    // Chain list should only show testnet chains (e.g., Sepolia, Alfajores)
    await expect(page.getByRole('button', { name: /Sepolia/i }).first()).toBeVisible();

    // Mainnet chains should not be visible
    await expect(page.getByRole('button', { name: 'ethereum Ethereum', exact: true })).not.toBeVisible();
  });

  test('should filter chains by Mainnet type', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open token selector and filter dropdown
    await page.getByRole('button', { name: 'ethereum HYPER Ethereum' }).click();
    await page.getByRole('button', { name: 'Filter chains' }).click();

    // Click Mainnet filter
    await page.getByRole('button', { name: 'Mainnet', exact: true }).click();

    // Should show mainnet chains
    await expect(page.getByRole('button', { name: 'ethereum Ethereum', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'arbitrum Arbitrum', exact: true })).toBeVisible();
  });
});
