import { test, expect } from '@playwright/test';
import { waitForTransferForm } from '../helpers/locators';

test.describe('Basic Rendering', () => {
  test('should render the unified form', async ({ page }) => {
    await page.goto('http://localhost:3000/embed');
    await waitForTransferForm(page);

    await expect(page.getByTestId('token-select-origin')).toBeVisible();
    await expect(page.getByTestId('token-select-destination')).toBeVisible();
    await expect(page.getByText(/Route:/)).toBeVisible();
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Connect wallet', exact: true }),
    ).toBeVisible();
  });

  test('should add embed-mode class to body', async ({ page }) => {
    await page.goto('http://localhost:3000/embed');
    await waitForTransferForm(page);

    await expect(page.locator('body')).toHaveClass(/embed-mode/);
  });

  test('should set embed-mode class before warp context loads', async ({ page }) => {
    // Navigate and check body class immediately (before unified form renders)
    await page.goto('http://localhost:3000/embed', { waitUntil: 'domcontentloaded' });
    // Poll for embed-mode class — should appear before the unified form
    await expect(page.locator('body')).toHaveClass(/embed-mode/, { timeout: 10000 });
  });
});
