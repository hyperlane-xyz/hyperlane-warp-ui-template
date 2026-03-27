import { test, expect } from '@playwright/test';

test.describe('Routes Parameter', () => {
  test('should load embed page with a valid routes param', async ({ page }) => {
    await page.goto('http://localhost:3000/embed?routes=USDC/aleo');
    await page.getByText('Send').first().waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.getByText('Send').first()).toBeVisible();
  });

  test('should load embed page with empty routes param gracefully', async ({ page }) => {
    await page.goto('http://localhost:3000/embed?routes=');
    await page.getByText('Send').first().waitFor({ state: 'visible' });
    await expect(page.getByText('Send').first()).toBeVisible();
  });

  test('should load embed page with multiple routes param', async ({ page }) => {
    await page.goto('http://localhost:3000/embed?routes=USDC/aleo,ETH/aleo');
    await page.getByText('Send').first().waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.getByText('Send').first()).toBeVisible();
  });

  test('should fail to load with fake/nonexistent route', async ({ page }) => {
    await page.goto('http://localhost:3000/embed?routes=FAKE/nonexistent-route');
    // Nonexistent routes cause the app to error — the page will be blank or show an error
    await page.waitForTimeout(10000);
    // "Send" should NOT be visible since the route doesn't exist
    await expect(page.getByText('Send').first()).not.toBeVisible();
  });

  test('should handle mix of real and fake routes', async ({ page }) => {
    await page.goto('http://localhost:3000/embed?routes=USDC/aleo,FAKE/does-not-exist');
    await page.getByText('Send').first().waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.getByText('Send').first()).toBeVisible();
  });
});
