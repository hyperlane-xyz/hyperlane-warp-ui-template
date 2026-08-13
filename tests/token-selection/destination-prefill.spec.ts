import { expect, test, type Page } from '@playwright/test';

import { getDestinationTokenButton, getOriginTokenButton } from '../helpers/locators';
import { installRouterApiMock, routerApiTokens } from '../helpers/routerApi';

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

    await getOriginTokenButton(page).click();
    const requestedPrefill = page.waitForRequest(isBaseOriginPrefillRequest, { timeout: 500 }).then(
      () => true,
      () => false,
    );
    await selectTokenRow(page, 'Base');

    await expect(getOriginTokenButton(page)).toHaveAttribute('data-chain', 'base');
    expect(await requestedPrefill).toBe(false);
    await expect(destinationButton).toHaveAttribute('data-chain', 'base');
  });

  test('does not apply an in-flight prefill after destination selection', async ({ page }) => {
    let releasePrefill = () => undefined;
    const prefillGate = new Promise<void>((resolve) => {
      releasePrefill = resolve;
    });
    await page.route('**/v1/available-routes**', async (route) => {
      if (!isBaseOriginPrefillRequest(route.request())) return route.fallback();
      await prefillGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ direction: 'fromSource', tokens: [routerApiTokens[0]] }),
      });
    });

    const prefillRequest = page.waitForRequest(isBaseOriginPrefillRequest);
    await selectToken(page, 'origin', 'Base');
    await prefillRequest;
    await selectToken(page, 'destination', 'Base');

    const prefillResponse = page.waitForResponse(isBaseOriginPrefillRequest);
    releasePrefill();
    await prefillResponse;
    await page.waitForTimeout(100);

    await expect(getDestinationTokenButton(page)).toHaveAttribute('data-chain', 'base');
  });
});

async function selectToken(page: Page, mode: 'origin' | 'destination', chainName: string) {
  const selector = mode === 'origin' ? getOriginTokenButton(page) : getDestinationTokenButton(page);
  await selector.click();
  await selectTokenRow(page, chainName);
}

async function selectTokenRow(page: Page, chainName: string) {
  await page.locator('.token-picker-row').filter({ hasText: chainName }).first().click();
}

function isBaseOriginPrefillRequest(request: { url(): string }): boolean {
  const url = new URL(request.url());
  return url.pathname === '/v1/available-routes' && url.searchParams.get('srcChain') === '8453';
}
