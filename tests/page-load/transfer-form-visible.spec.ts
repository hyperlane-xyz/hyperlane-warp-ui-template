import { test, expect } from '@playwright/test';
import { APP_NAME } from '../../src/consts/app';
import { config } from '../../src/consts/config';
import { splitTokenId } from '../helpers/constants';
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

    // Send section: default engine origin token when configured.
    const originButton = getOriginTokenButton(page);
    await expect(originButton).toBeVisible();
    const origin = splitTokenId(config.defaultTransferOriginToken);
    if (origin) {
      await expect(originButton).toHaveAttribute('data-chain', origin.chainName);
    }

    // Amount input visible
    const amountInput = page.getByRole('spinbutton');
    await expect(amountInput).toBeVisible();

    // Max button visible but disabled
    const maxButton = page.getByRole('button', { name: 'Max' });
    await expect(maxButton).toBeVisible();
    await expect(maxButton).toBeDisabled();

    await expect(page.getByText('$0.00').first()).toBeVisible();
    await expect(page.locator('.transfer-balance').first()).toContainText(/Balance:/);

    // Receive section: default destination token
    const destButton = getDestinationTokenButton(page);
    await expect(destButton).toBeVisible();
    const destination = splitTokenId(config.defaultTransferDestinationToken);
    if (destination) {
      await expect(destButton).toHaveAttribute('data-chain', destination.chainName);
    }
    await expect(page.getByText(/^Remote Balance:/)).toBeVisible();
  });
});
