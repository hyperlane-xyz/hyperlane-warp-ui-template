import { expect, test, type Page } from '@playwright/test';

import { getDestinationTokenButton, getOriginTokenButton } from '../helpers/locators';
import { installRouterApiMock } from '../helpers/routerApi';

test.describe('Token Selection - Destination Prefill', () => {
  test.beforeEach(async ({ page }) => {
    await installRouterApiMock(page);
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });
  });

  test('requests destination prefill before destination token selection', async ({ page }) => {
    const prefillRequest = page.waitForRequest(isBaseOriginPrefillRequest);

    await selectToken(page, 'origin', 'Base');
    await prefillRequest;
  });

  test('stops prefilling after destination token selection', async ({ page }) => {
    const destinationButton = getDestinationTokenButton(page);
    await selectToken(page, 'destination', 'Base');
    await expect(destinationButton).toHaveAttribute('data-chain', 'base');

    let requestedPrefill = false;
    page.on('request', (request) => {
      if (isBaseOriginPrefillRequest(request)) requestedPrefill = true;
    });

    await selectToken(page, 'origin', 'Base');
    await expect(getOriginTokenButton(page)).toHaveAttribute('data-chain', 'base');

    expect(requestedPrefill).toBe(false);
    await expect(destinationButton).toHaveAttribute('data-chain', 'base');
  });
});

async function selectToken(page: Page, mode: 'origin' | 'destination', chainName: string) {
  const selector = mode === 'origin' ? getOriginTokenButton(page) : getDestinationTokenButton(page);
  await selector.click();
  await page.locator('.token-picker-row').filter({ hasText: chainName }).first().click();
}

function isBaseOriginPrefillRequest(request: { url(): string }): boolean {
  const url = new URL(request.url());
  return url.pathname === '/v1/available-routes' && url.searchParams.get('srcChain') === '8453';
}
