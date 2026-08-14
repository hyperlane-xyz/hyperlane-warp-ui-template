import { test, expect } from '@playwright/test';
import { selectOriginTokenOnChain } from '../e2e-wallet/helpers/formFlow';

test.describe('Wallet Connect - Protocol Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });
  });

  test('EVM: should show RainbowKit modal for Ethereum', async ({ page }) => {
    // Default origin is Ethereum (EVM) - click the main Connect wallet button
    await page
      .getByRole('main')
      .getByRole('button', { name: 'Connect wallet', exact: true })
      .click();

    const dialog = page.getByRole('dialog', { name: 'Connect a Wallet' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Connect a Wallet' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'MetaMask' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'WalletConnect' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Coinbase Wallet' }),
    ).toBeVisible();

    // Close
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('Sealevel: should show Solana wallet modal', async ({ page }) => {
    await selectOriginTokenOnChain(page, /solanamainnet Solana/i, /solanamainnet USDC Solana/i);

    await page
      .getByRole('main')
      .getByRole('button', { name: 'Connect wallet', exact: true })
      .click();

    // Solana wallet modal
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('Connect a wallet on Solana to continue'),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Solflare' }),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('Cosmos: should lazy-load the Cosmos wallet modal', async ({ page }) => {
    await page
      .getByRole('banner')
      .getByRole('button', { name: 'Connect wallet', exact: true })
      .click();

    await page
      .getByRole('dialog')
      .getByRole('button', {
        name: 'Cosmos Connect to a Cosmos-compatible wallet',
      })
      .click();

    const dialog = page.getByRole('dialog', { name: 'Select your wallet' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Keplr Keplr' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Cosmostation Cosmostation' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Leap Leap' }),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
