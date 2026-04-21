import { test, expect } from '@playwright/test';
import { config } from '../../src/consts/config';
import { isTestnetChain, resolveChainDisplayName } from '../helpers/constants';
import { getOriginTokenButton } from '../helpers/locators';

// Default origin is assumed mainnet — used to verify the Testnet filter hides it.
// Match chain rows by displayName (what the UI renders), not by the internal slug.
const defaultOriginChain = config.defaultOriginToken?.split('-')[0];

test.describe('Chain Selection - Filter by Type', () => {
  test('should filter chains by Testnet type', async ({ page }) => {
    test.skip(!defaultOriginChain, 'No defaultOriginToken configured');
    test.skip(
      await isTestnetChain(defaultOriginChain!),
      'Default origin is a testnet chain — test assumes mainnet default',
    );
    const defaultChainDisplayName = await resolveChainDisplayName(defaultOriginChain!);

    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open token selector
    await getOriginTokenButton(page).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    const defaultChainRow = page
      .locator('.token-picker-chain-row')
      .filter({ hasText: defaultChainDisplayName });

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

    // Clear button appears only when a filter is active — confirms click took effect
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();

    // Mainnet chain (default origin) row should no longer be visible
    await expect(defaultChainRow).toHaveCount(0);
  });

  test('should filter chains by Mainnet type', async ({ page }) => {
    test.skip(!defaultOriginChain, 'No defaultOriginToken configured');
    test.skip(
      await isTestnetChain(defaultOriginChain!),
      'Default origin is a testnet chain — test assumes mainnet default',
    );
    const defaultChainDisplayName = await resolveChainDisplayName(defaultOriginChain!);

    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open token selector and filter dropdown
    await getOriginTokenButton(page).click();
    await page.getByRole('button', { name: 'Filter chains' }).click();

    // Click Mainnet filter
    await page.getByRole('button', { name: 'Mainnet', exact: true }).click();

    // Clear button confirms the filter is active (not a silent no-op)
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();

    // Default origin chain row (mainnet) remains visible after Mainnet filter
    await expect(
      page
        .locator('.token-picker-chain-row')
        .filter({ hasText: defaultChainDisplayName })
        .first(),
    ).toBeVisible();
  });
});
