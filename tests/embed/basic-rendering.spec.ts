import { test, expect } from '@playwright/test';

test.describe('Basic Rendering', () => {
  test('should render transfer form with Send and Receive sections', async ({ page }) => {
    await page.goto('http://localhost:3000/embed');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await expect(page.getByText('Send').first()).toBeVisible();
    await expect(page.getByText('Receive').first()).toBeVisible();
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Connect wallet', exact: true }),
    ).toBeVisible();
  });

  test('should add embed-mode class to body', async ({ page }) => {
    await page.goto('http://localhost:3000/embed');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await expect(page.locator('body')).toHaveClass(/embed-mode/);
  });

  test('should set embed-mode class before warp context loads', async ({ page }) => {
    // Navigate and check body class immediately (before transfer form renders)
    await page.goto('http://localhost:3000/embed', { waitUntil: 'domcontentloaded' });
    // Poll for embed-mode class — should appear before the transfer form
    await expect(page.locator('body')).toHaveClass(/embed-mode/, { timeout: 10000 });
  });
});
