import { test, expect } from '@playwright/test';
import { APP_NAME } from '../../src/consts/app';
import { config } from '../../src/consts/config';
import {
  getDestinationTokenButton,
  getOriginTokenButton,
  waitForUnifiedForm,
} from '../helpers/locators';

function parseConfigTokenRef(value: string): { chainName: string; tokenRef: string } {
  const separator = value.indexOf('-');
  return {
    chainName: value.slice(0, separator),
    tokenRef: value.slice(separator + 1),
  };
}

function isSymbolRef(value: string): boolean {
  return /^[A-Z0-9]{2,12}$/.test(value);
}

test.describe('Page Load - Unified Form', () => {
  test('should display the unified form on page load', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await waitForUnifiedForm(page);

    // Page title
    await expect(page).toHaveTitle(APP_NAME);

    // Connect wallet button visible
    await expect(page.getByRole('button', { name: 'Connect wallet' }).first()).toBeVisible();

    // Send section: default origin token (only assert when configured; otherwise the app
    // falls back to featuredTokens / explicit defaults — covered elsewhere)
    const originButton = getOriginTokenButton(page);
    await expect(originButton).toBeVisible();
    if (config.defaultOriginToken) {
      const origin = parseConfigTokenRef(config.defaultOriginToken);
      await expect(originButton).toHaveAttribute('data-chain', origin.chainName);
      if (isSymbolRef(origin.tokenRef)) await expect(originButton).toContainText(origin.tokenRef);
    }

    // Amount input visible
    const amountInput = page.getByRole('spinbutton');
    await expect(amountInput).toBeVisible();

    // Max button visible
    const maxButton = page.getByRole('button', { name: 'Max' });
    await expect(maxButton).toBeVisible();
    await expect(maxButton).toBeDisabled();

    // USD price and balance
    await expect(page.getByText('$0.00')).toBeVisible();
    await expect(page.getByText('Balance: 0.00', { exact: true })).toBeVisible();

    // Receive section: default destination token
    const destButton = getDestinationTokenButton(page);
    await expect(destButton).toBeVisible();
    if (config.defaultDestinationToken) {
      const destination = parseConfigTokenRef(config.defaultDestinationToken);
      await expect(destButton).toHaveAttribute('data-chain', destination.chainName);
      if (isSymbolRef(destination.tokenRef))
        await expect(destButton).toContainText(destination.tokenRef);
    }
    await expect(page.getByText('Remote Balance: 0.00')).toBeVisible();
  });
});
