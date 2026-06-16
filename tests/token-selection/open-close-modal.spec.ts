import { test, expect } from '@playwright/test';
import { getOriginTokenButton, waitForUnifiedForm } from '../helpers/locators';

test.describe('Token Selection - Open and Close Modal', () => {
  test('should open and close token selection modal', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await waitForUnifiedForm(page);

    // Open origin token selector
    await getOriginTokenButton(page).click();

    // Modal should open
    await expect(page.getByText('Select Token')).toBeVisible();
    await expect(page.getByText('Chain Selection')).toBeVisible();
    await expect(page.getByText('All Chains')).toBeVisible();
    await expect(page.getByText('Token Selection')).toBeVisible();
    await expect(page.getByPlaceholder('Search Chains')).toBeVisible();
    await expect(page.getByPlaceholder('Search Name, Symbol, or Contract Address')).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');

    // Modal should close, unified form visible again
    await expect(page.getByText('Select Token')).not.toBeVisible();
    await expect(getOriginTokenButton(page)).toBeVisible();
  });
});
