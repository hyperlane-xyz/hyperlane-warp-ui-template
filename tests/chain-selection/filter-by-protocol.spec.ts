import { test, expect } from '@playwright/test';
import { getOriginTokenButton } from '../helpers/locators';

test.describe('Chain Selection - Filter by Protocol', () => {
  test('should filter chains by Sealevel protocol', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open token selector
    await getOriginTokenButton(page).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    // Open filter dropdown
    await page.getByRole('button', { name: 'Filter chains' }).click();

    // Click Sealevel protocol filter
    await page.getByRole('button', { name: 'Sealevel' }).click();

    // Should show Solana chains
    await expect(page.getByRole('button', { name: /Solana/i }).first()).toBeVisible();

    // EVM chains should not be visible
    await expect(page.getByRole('button', { name: 'ethereum Ethereum', exact: true })).not.toBeVisible();
  });

  test('should filter chains by Cosmos protocol', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();
    await page.getByRole('button', { name: 'Filter chains' }).click();

    // Click Cosmos protocol filter
    await page.getByRole('button', { name: 'Cosmos', exact: true }).click();

    // Should show Cosmos chains (e.g., Neutron, Osmosis, Stride)
    await expect(page.getByRole('button', { name: /neutron Neutron/i })).toBeVisible();
  });

  test('should clear filters', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();
    await page.getByRole('button', { name: 'Filter chains' }).click();

    // Apply a filter
    await page.getByRole('button', { name: 'Testnet', exact: true }).click();

    // Clear button should appear
    await expect(page.getByText('Clear')).toBeVisible();

    // Click Clear
    await page.getByText('Clear').click();

    // All chains should be visible again (including mainnet)
    await expect(page.getByRole('button', { name: 'ethereum Ethereum', exact: true })).toBeVisible();
  });
});
