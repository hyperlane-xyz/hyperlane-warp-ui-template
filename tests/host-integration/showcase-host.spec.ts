import { expect, test } from '@playwright/test';

test('mantraUSD-style showcase loads embedded widget', async ({ page }) => {
  await page.goto('/showcase/mantrausd');
  await expect(page.locator('iframe[data-testid="warp-widget-iframe"]')).toHaveCount(1, {
    timeout: 45_000,
  });
  const frame = page.frameLocator('iframe[data-testid="warp-widget-iframe"]');
  await expect(frame.getByTestId('warp-widget-root')).toHaveCount(1, { timeout: 45_000 });
});

test('USD.AI-style showcase loads embedded widget', async ({ page }) => {
  await page.goto('/showcase/usdai');
  await expect(page.locator('iframe[data-testid="warp-widget-iframe"]')).toHaveCount(1, {
    timeout: 45_000,
  });
  const frame = page.frameLocator('iframe[data-testid="warp-widget-iframe"]');
  await expect(frame.getByTestId('warp-widget-root')).toHaveCount(1, { timeout: 45_000 });
});
