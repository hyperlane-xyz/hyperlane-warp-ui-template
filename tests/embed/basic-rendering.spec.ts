// spec: embed page basic rendering
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Basic Rendering', () => {
  test('should render transfer form with Send and Receive sections', async ({ page }) => {
    // Navigate to http://localhost:3000/embed
    await page.goto('http://localhost:3000/embed');

    // Wait for page to load (wait for network idle)
    await new Promise(f => setTimeout(f, 3 * 1000));

    // Verify text "Send" is visible (section header)
    await expect(page.getByText('Send')).toBeVisible();

    // Verify text "Receive" is visible (section header)
    await expect(page.getByText('Receive')).toBeVisible();

    // Verify there is an input with placeholder "0" (amount input)
    await expect(page.getByRole('spinbutton', { name: '' })).toBeVisible();

    // Verify text "Connect wallet" is visible (submit/wallet button)
    await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeVisible();
  });

  test('should add embed-mode class to body', async ({ page }) => {
    // Navigate to http://localhost:3000/embed
    await page.goto('http://localhost:3000/embed');

    // Wait for page to load
    await new Promise(f => setTimeout(f, 3 * 1000));

    // Evaluate: document.body.classList.contains('embed-mode') should be true
    await expect(page.locator('body')).toHaveClass(/embed-mode/);
  });
});
