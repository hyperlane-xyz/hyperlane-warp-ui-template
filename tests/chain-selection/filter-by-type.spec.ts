import { test, expect } from '@playwright/test';
import { config } from '../../src/consts/config';
import { getOriginTokenButton } from '../helpers/locators';

// Default origin is assumed mainnet — used to verify the Testnet filter hides it.
// Chain rows in the ChainFilterPanel use the .token-picker-chain-row class.
const defaultOriginChain = config.defaultOriginToken?.split('-')[0];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Anchor to start and follow with word boundary so short names (e.g. "eth") don't match "ethereum"
const chainRowRegex = defaultOriginChain
  ? new RegExp(`^${escapeRegex(defaultOriginChain)}\\b`, 'i')
  : null;

test.describe('Chain Selection - Filter by Type', () => {
  test('should filter chains by Testnet type', async ({ page }) => {
    test.skip(!defaultOriginChain, 'No defaultOriginToken configured');

    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open token selector
    await getOriginTokenButton(page).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    const defaultChainRow = page
      .locator('.token-picker-chain-row')
      .filter({ hasText: chainRowRegex! });

    // Baseline: default origin (mainnet) chain row is visible before filtering
    await expect(defaultChainRow.first()).toBeVisible();

    // Open filter dropdown
    await page.getByRole('button', { name: 'Filter chains' }).click();

    // Verify filter panel shows
    await expect(page.getByText('Filters')).toBeVisible();
    await expect(page.getByText('Type')).toBeVisible();
    await expect(page.getByText('Protocol', { exact: true })).toBeVisible();

    // Click Testnet filter
    await page.getByRole('button', { name: 'Testnet', exact: true }).click();

    // Mainnet chain (default origin) row should no longer be visible — filter works
    await expect(defaultChainRow).toHaveCount(0);
  });

  test('should filter chains by Mainnet type', async ({ page }) => {
    test.skip(!defaultOriginChain, 'No defaultOriginToken configured');

    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open token selector and filter dropdown
    await getOriginTokenButton(page).click();
    await page.getByRole('button', { name: 'Filter chains' }).click();

    // Click Mainnet filter
    await page.getByRole('button', { name: 'Mainnet', exact: true }).click();

    // Default origin chain row (mainnet) remains visible after Mainnet filter
    await expect(
      page
        .locator('.token-picker-chain-row')
        .filter({ hasText: chainRowRegex! })
        .first(),
    ).toBeVisible();
  });
});
