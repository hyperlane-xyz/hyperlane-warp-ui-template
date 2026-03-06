import { test, expect } from '@playwright/test';
import { getOriginTokenButton } from '../helpers/locators';

test.describe('Chain Selection - Sort Chains', () => {
  test('should open sort dropdown and show sort options', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    // Open sort dropdown
    await page.getByRole('button', { name: 'Sort: Name (asc)' }).click();

    // Should show sort options
    await expect(page.getByText('Sort by')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Name', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chain Id', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Protocol', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle sort order' })).toBeVisible();
  });

  test('should sort chains by Chain Id', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();

    // Get first chain in default (Name asc) sort
    const chainButtons = page.locator('button[class*="border-l-2"]');
    const firstChainDefault = await chainButtons.nth(1).textContent();

    // Switch to Chain Id sort
    await page.getByRole('button', { name: 'Sort: Name (asc)' }).click();
    await page.getByRole('button', { name: 'Chain Id', exact: true }).click();

    // First chain should be different after sorting by Chain Id
    const firstChainById = await chainButtons.nth(1).textContent();
    expect(firstChainById).not.toBe(firstChainDefault);
  });

  test('should toggle sort order', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();

    // Default sort is Name (asc) - first chain should start with 'A'
    const chainButtons = page.locator('button[class*="border-l-2"]');
    const firstChainBefore = chainButtons.nth(1); // nth(0) is "All Chains"
    await expect(firstChainBefore).toContainText(/^[A-B]/);

    // Open sort and toggle order to desc
    await page.getByRole('button', { name: 'Sort: Name (asc)' }).click();
    await page.getByRole('button', { name: 'Toggle sort order' }).click();

    // First chain should now start with Z
    await expect(chainButtons.nth(1)).toContainText(/^[Z]/);
  });
});
