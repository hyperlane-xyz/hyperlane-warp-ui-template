// spec: No Chrome
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { waitForUnifiedForm } from '../helpers/locators';

test.describe('No Chrome', () => {
  test('should not show header navigation on embed page', async ({ page }) => {
    // Navigate to the embed page
    await page.goto('http://localhost:3000/embed');

    await waitForUnifiedForm(page);

    // Verify no header element exists on the embed page
    await expect(page.locator('header')).toHaveCount(0);
  });

  test('should not show footer on embed page', async ({ page }) => {
    // Navigate to the embed page
    await page.goto('http://localhost:3000/embed');

    await waitForUnifiedForm(page);

    // Verify no footer element exists on the embed page
    await expect(page.locator('footer')).toHaveCount(0);
  });

  test('main app still shows header and footer (contrast)', async ({ page }) => {
    // Navigate to the main app page
    await page.goto('http://localhost:3000/');

    await waitForUnifiedForm(page);

    // Verify the main app has a header element
    await expect(page.locator('header')).toBeVisible();

    // Verify the main app has a footer element
    await expect(page.locator('footer')).toBeVisible();
  });
});
