import type { Page, Locator } from '@playwright/test';

export function getOriginTokenButton(page: Page): Locator {
  return page.getByTestId('token-select-origin');
}

export function getDestinationTokenButton(page: Page): Locator {
  return page.getByTestId('token-select-destination');
}
