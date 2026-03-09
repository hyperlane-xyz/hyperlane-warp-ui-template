import { expect, test } from '@playwright/test';

test('iframe host mounts widget and relays ready event', async ({ page }) => {
  await page.goto('/iframe');

  await expect(page.getByTestId('iframe-container')).toHaveCount(1);
  await expect(page.getByTestId('iframe-event-log')).toHaveText('ready', { timeout: 45_000 });

  const frame = page.frameLocator('iframe[data-testid="warp-widget-iframe"]');
  await expect(frame.getByTestId('warp-widget-root')).toHaveCount(1);
  await expect(frame.getByTestId('warp-widget-ready')).toHaveCount(1);
});

test('iframe event bridge ignores malformed or untrusted events', async ({ page }) => {
  await page.goto('/iframe');
  await expect(page.getByTestId('iframe-event-log')).toHaveText('ready', { timeout: 45_000 });

  await page.evaluate(() => {
    window.postMessage('malformed', '*');
    window.postMessage({ type: 'hyperlane-warp-widget' }, '*');
    window.postMessage({ type: 'hyperlane-warp-widget', event: { type: 'error' } }, '*');
  });

  await expect(page.getByTestId('iframe-event-log')).toHaveText('ready');
});
