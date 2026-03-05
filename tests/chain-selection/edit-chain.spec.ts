import { test, expect } from '@playwright/test';

test.describe('Chain Selection - Edit Chain', () => {
  test('should enter edit mode and open chain edit modal', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open token selector
    await page.getByRole('button', { name: 'ethereum HYPER Ethereum' }).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    // Click edit mode pencil button
    await page.getByRole('button', { name: 'Edit chain metadata' }).click();

    // Button should now say "Exit edit mode"
    await expect(page.getByRole('button', { name: 'Exit edit mode' })).toBeVisible();

    // Click on Ethereum chain in edit mode
    await page.getByRole('button', { name: 'ethereum Ethereum', exact: true }).click();

    // Chain edit modal should open
    await expect(page.getByText('Edit Ethereum')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ethereum Metadata' })).toBeVisible();

    // Should show chain details
    await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Block Explorers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chain Information' })).toBeVisible();

    // Chain info details
    await expect(page.getByRole('heading', { name: 'Chain ID' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Domain ID' })).toBeVisible();
    await expect(page.getByText('Mainnet', { exact: true })).toBeVisible();

    // Should have action buttons
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy Metadata' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View in registry' })).toBeVisible();
  });

  test('should close edit modal with Back button', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await page.getByRole('button', { name: 'ethereum HYPER Ethereum' }).click();
    await page.getByRole('button', { name: 'Edit chain metadata' }).click();
    await page.getByRole('button', { name: 'ethereum Ethereum', exact: true }).click();

    // Verify modal is open
    await expect(page.getByText('Edit Ethereum')).toBeVisible();

    // Click Back
    await page.getByRole('button', { name: 'Back' }).click();

    // Modal should close, back to token selector
    await expect(page.getByText('Edit Ethereum')).not.toBeVisible();
    await expect(page.getByText('Select Token')).toBeVisible();
  });

  test('should exit edit mode', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await page.getByRole('button', { name: 'ethereum HYPER Ethereum' }).click();

    // Enter edit mode
    await page.getByRole('button', { name: 'Edit chain metadata' }).click();
    await expect(page.getByRole('button', { name: 'Exit edit mode' })).toBeVisible();

    // Exit edit mode
    await page.getByRole('button', { name: 'Exit edit mode' }).click();

    // Should show "Edit chain metadata" again
    await expect(page.getByRole('button', { name: 'Edit chain metadata' })).toBeVisible();
  });
});
