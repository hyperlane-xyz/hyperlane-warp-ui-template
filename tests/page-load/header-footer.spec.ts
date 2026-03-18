import { test, expect } from '@playwright/test';

test.describe('Page Load - Header and Footer', () => {
  test('should display header and footer', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Header
    await expect(page.getByRole('link', { name: 'Homepage' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('button', { name: 'Connect wallet' })).toBeVisible();

    // Footer links
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'Stake' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'X.com' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Hyperlane' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Support' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Docs' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Github' })).toBeVisible();
  });
});
