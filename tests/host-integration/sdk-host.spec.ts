import { expect, test } from '@playwright/test';

test('SDK host renders widget and receives ready event', async ({ page }) => {
  await page.goto('/sdk');

  await expect(page.getByTestId('warp-widget-root')).toHaveCount(1);
  await expect(page.getByTestId('event-log')).toHaveText('ready');
  await expect(page.getByTestId('warp-widget-ready')).toHaveCount(1);

  const frame = page.frameLocator('iframe[data-testid="warp-widget-iframe"]');
  await expect(frame.getByTestId('warp-widget-root')).toHaveCount(1);
  await expect(frame.getByTestId('warp-widget-ready')).toHaveCount(1);
});
