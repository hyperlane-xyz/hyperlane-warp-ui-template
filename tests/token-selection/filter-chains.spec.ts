import { test, expect } from '@playwright/test';
import { getOriginTokenButton } from '../helpers/locators';

test.describe('Token Selection - Filter Chains', () => {
  test('should filter chains by search', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open origin token selector
    await getOriginTokenButton(page).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    // Type in chain search
    await page.getByPlaceholder('Search Chains').fill('Base');

    // Should show Base in the chain list
    await expect(page.getByRole('button', { name: 'base Base', exact: true })).toBeVisible();

    // Click on Base chain
    await page.getByRole('button', { name: 'base Base', exact: true }).click();

    // Token list should filter to show Base tokens
    await expect(page.getByText('Base').first()).toBeVisible();
  });
});
