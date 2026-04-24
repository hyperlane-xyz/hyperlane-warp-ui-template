import { test, expect } from '@playwright/test';
import { config } from '../../src/consts/config';
import { getOriginTokenButton } from '../helpers/locators';

// Match chain rows by the `data-chain` slug (what ChainList renders) instead of
// reconstructing a displayName at test time.
const defaultOriginChain = config.defaultOriginToken?.split('-')[0];

test.describe('Chain Selection - Filter by Type', () => {
  test('should filter chains by Testnet type', async ({ page }) => {
    test.skip(!defaultOriginChain, 'No defaultOriginToken configured');

    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Read default origin's testnet status directly from the token select button's data attribute
    const originButton = getOriginTokenButton(page);
    await expect(originButton).toBeVisible();
    test.skip(
      (await originButton.getAttribute('data-is-testnet')) === 'true',
      'Default origin is a testnet chain — test assumes mainnet default',
    );

    // Open token selector
    await originButton.click();
    await expect(page.getByText('Select Token')).toBeVisible();

    const defaultChainRow = page.locator(
      `.token-picker-chain-row[data-chain="${defaultOriginChain}"]`,
    );

    // Baseline: default origin (mainnet) chain row is visible before filtering
    await expect(defaultChainRow).toBeVisible();

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

    // No mainnet chain rows should remain visible — covers more than just the default
    await expect(
      page.locator('.token-picker-chain-row[data-is-testnet="false"]'),
    ).toHaveCount(0);
  });

  test('should filter chains by Mainnet type', async ({ page }) => {
    test.skip(!defaultOriginChain, 'No defaultOriginToken configured');

    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    const originButton = getOriginTokenButton(page);
    await expect(originButton).toBeVisible();
    test.skip(
      (await originButton.getAttribute('data-is-testnet')) === 'true',
      'Default origin is a testnet chain — test assumes mainnet default',
    );

    // Open token selector and filter dropdown
    await originButton.click();
    await page.getByRole('button', { name: 'Filter chains' }).click();

    // Click Mainnet filter
    await page.getByRole('button', { name: 'Mainnet', exact: true }).click();

    // Clear button confirms the filter is active (not a silent no-op)
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();

    // Default origin chain row (mainnet) remains visible after Mainnet filter
    await expect(
      page.locator(`.token-picker-chain-row[data-chain="${defaultOriginChain}"]`),
    ).toBeVisible();

    // Negative check: no testnet chain rows should remain
    await expect(
      page.locator('.token-picker-chain-row[data-is-testnet="true"]'),
    ).toHaveCount(0);
  });
});
