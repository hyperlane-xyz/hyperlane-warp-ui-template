import { test, expect } from '@playwright/test';
import { getOriginTokenButton } from '../helpers/locators';

test.describe('Chain Selection - Filter by Protocol', () => {
  test('should filter chains by Sealevel protocol', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open token selector
    await getOriginTokenButton(page).click();
    await expect(page.getByText('Select Token', { exact: true })).toBeVisible();

    // Open filter dropdown
    await page.getByRole('button', { name: 'Filter chains' }).click();

    // Click Sealevel protocol filter
    await page.getByRole('button', { name: 'Sealevel' }).click();

    // Should show Solana chains
    await expect(page.getByRole('button', { name: /Solana/i }).first()).toBeVisible();

    // EVM chains should not be visible
    await expect(page.getByRole('button', { name: 'ethereum Ethereum', exact: true })).not.toBeVisible();
  });

  test('should filter chains by Tron protocol', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();
    await page.getByRole('button', { name: 'Filter chains' }).click();

    await page.getByRole('button', { name: 'Tron', exact: true }).click();

    await expect(page.locator('.token-picker-chain-row[data-chain="tron"]')).toBeVisible();
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
    await expect(page.locator('.token-picker-chain-row[data-chain="ethereum"]')).toBeVisible();
  });
});
