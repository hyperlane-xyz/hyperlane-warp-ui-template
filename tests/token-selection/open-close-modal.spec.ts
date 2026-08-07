import { test, expect } from '@playwright/test';
import { getOriginTokenButton } from '../helpers/locators';

test.describe('Token Selection - Open and Close Modal', () => {
  test('should open and close token selection modal', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open origin token selector
    await getOriginTokenButton(page).click();

    // Modal should open
    const modal = page
      .locator('div.token-picker-modal[data-headlessui-state="open"]:not([data-closed])')
      .filter({ hasText: 'Select Token' });
    await expect(modal).toBeVisible();
    await expect(page.getByText('Select Token', { exact: true })).toBeVisible();
    await expect(page.getByText('Chain Selection')).toBeVisible();
    await expect(page.getByText('All Chains')).toBeVisible();
    await expect(page.getByText('Token Selection')).toBeVisible();
    await expect(page.getByPlaceholder('Search Chains')).toBeVisible();
    await expect(page.getByPlaceholder('Search Name, Symbol, or Contract Address')).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    if (await modal.count()) await page.mouse.click(10, 10);

    // Modal should close, transfer form visible again
    await expect(modal).toHaveCount(0);
    await expect(page.getByText('Send').first()).toBeVisible();
  });
});
