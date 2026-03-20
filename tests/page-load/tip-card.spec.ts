import { test, expect } from '@playwright/test';

test.describe('Page Load - Tip Card', () => {
  test('should display tip card', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Tip card visible
    const heading = page.getByRole('heading', { name: 'Bridge Tokens with Hyperlane Warp Routes!' });
    await expect(heading).toBeVisible();
    await expect(page.getByRole('link', { name: 'More' })).toBeVisible();

    // Close tip card
    await page.getByRole('button', { name: 'Hide tip' }).click();

    // Tip card should disappear
    await expect(heading).not.toBeVisible();
  });
});
