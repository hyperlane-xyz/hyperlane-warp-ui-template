import { test, expect } from '@playwright/test';
import { APP_NAME } from '../../src/consts/app';
import { config } from '../../src/consts/config';
import { getDestinationTokenButton, getOriginTokenButton } from '../helpers/locators';

test.describe('Page Load - Transfer Form', () => {
  test('should display the transfer form on page load', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Page title
    await expect(page).toHaveTitle(APP_NAME);

    // Send and Receive sections visible
    await expect(page.getByText('Send').first()).toBeVisible();
    await expect(page.getByText('Receive').first()).toBeVisible();

    // Connect wallet button visible
    await expect(page.getByRole('button', { name: 'Connect wallet' }).first()).toBeVisible();

    // Send section: default origin token (only assert when configured; otherwise the app
    // falls back to featuredTokens / first routable token — covered elsewhere)
    const originButton = getOriginTokenButton(page);
    await expect(originButton).toBeVisible();
    if (config.defaultOriginToken) {
      const [originChain, originSymbol] = config.defaultOriginToken.split('-');
      await expect(originButton).toHaveAttribute('data-chain', originChain);
      await expect(originButton).toContainText(originSymbol);
    }

    // Amount input visible
    const amountInput = page.getByRole('spinbutton');
    await expect(amountInput).toBeVisible();

    // Max button visible but disabled
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
      const [destChain, destSymbol] = config.defaultDestinationToken.split('-');
      await expect(destButton).toHaveAttribute('data-chain', destChain);
      await expect(destButton).toContainText(destSymbol);
    }
    await expect(page.getByText('Remote Balance: 0.00')).toBeVisible();
  });
});
