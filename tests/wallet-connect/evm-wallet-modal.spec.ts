import { test, expect } from '@playwright/test';

test.describe('Wallet Connect - EVM', () => {
  test('should show RainbowKit modal when connecting wallet for EVM chain', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Default origin is Ethereum (EVM) - click Connect Wallet in Send section
    await page.getByRole('button', { name: 'Connect Wallet' }).nth(1).click();

    // RainbowKit modal should appear
    const dialog = page.getByRole('dialog', { name: 'Connect a Wallet' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Connect a Wallet' })).toBeVisible();

    // Should show EVM wallet options
    await expect(dialog.getByRole('button', { name: 'MetaMask' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'WalletConnect' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Coinbase Wallet' })).toBeVisible();

    // Close the modal
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('should show RainbowKit modal for BSC destination chain', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Destination is BSC (EVM) - click Connect Wallet dropdown in Receive section
    // The destination has a dropdown menu, click it to show connect option
    const receiveSection = page.getByText('Receive').first().locator('../../..');
    await receiveSection.getByText('Connect Wallet').click();

    // Dropdown menu should appear with "Connect wallet" option
    await expect(page.getByRole('button', { name: 'Connect wallet' }).last()).toBeVisible();
  });
});
