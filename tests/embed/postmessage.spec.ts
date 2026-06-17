import { expect, test } from '@playwright/test';

test.describe('Embed postMessage', () => {
  test('emits ready events to the parent frame', async ({ page }) => {
    await page.route('http://localhost:3000/embed-parent', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `
          <script>
            window.__messages = [];
            window.addEventListener('message', (event) => {
              window.__messages.push(event.data);
            });
          </script>
          <iframe src="/embed"></iframe>
        `,
      }),
    );

    await page.goto('http://localhost:3000/embed-parent');

    await expect
      .poll(async () =>
        page.evaluate(() =>
          (window as any).__messages.some(
            (message) =>
              message?.type === 'hyperlane-warp-widget' &&
              message?.event?.type === 'ready' &&
              typeof message?.event?.payload?.timestamp === 'number',
          ),
        ),
      )
      .toBe(true);
  });
});
