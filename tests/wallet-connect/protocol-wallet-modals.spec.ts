import { test, expect } from '@playwright/test';

// Helper to select a token from a given chain via the token selector
async function selectToken(
  page: import('@playwright/test').Page,
  tokenSearch: string,
  tokenButtonName: RegExp,
) {
  // Open origin token selector
  const sendSection = page.locator('main');
  const originTokenBtn = sendSection
    .locator('button')
    .filter({ hasText: /Ethereum|Solana|Neutron|Aleo|Radix|Starknet/ })
    .first();
  await originTokenBtn.click();
  await page.getByText('Select Token').waitFor({ state: 'visible' });

  // Search and select the token
  const searchBox = page.getByPlaceholder(
    'Search Name, Symbol, or Contract Address',
  );
  await searchBox.fill(tokenSearch);
  await page
    .getByRole('button', { name: tokenButtonName })
    .first()
    .waitFor({ state: 'visible' });
  await page.getByRole('button', { name: tokenButtonName }).first().click();
  await expect(page.getByText('Select Token')).not.toBeVisible();
}

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
    await selectToken(page, 'solana', /solanamainnet SOL Solana/);

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

  test('Cosmos: should show Cosmos wallet modal for Neutron', async ({
    page,
  }) => {
    await selectToken(page, 'ECLIP', /neutron ECLIP Neutron/);

    await page
      .getByRole('main')
      .getByRole('button', { name: 'Connect wallet', exact: true })
      .click();

    // Cosmos wallet modal - "Select your wallet"
    const dialog = page.getByRole('dialog', { name: 'Select your wallet' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Select your wallet')).toBeVisible();
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

  test('Aleo: should show Aleo wallet modal', async ({ page }) => {
    await selectToken(page, 'aleo', /aleo ALEO Aleo Aleo/);

    await page
      .getByRole('main')
      .getByRole('button', { name: 'Connect wallet', exact: true })
      .click();

    // Aleo wallet modal - "Connect with an Aleo Wallet"
    await expect(
      page.getByRole('heading', { name: 'Connect with an Aleo Wallet' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Shield Wallet Shield Wallet' }),
    ).toBeVisible();

    // Close
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(
      page.getByRole('heading', { name: 'Connect with an Aleo Wallet' }),
    ).not.toBeVisible();
  });

  test('Radix: should show Radix wallet overlay', async ({ page }) => {
    await selectToken(page, 'radix', /radix hSOL Radix/);

    await page
      .getByRole('main')
      .getByRole('button', { name: 'Connect wallet', exact: true })
      .click();

    // Radix uses a custom overlay, not a dialog role
    await expect(page.getByText('Login Request Pending')).toBeVisible();
    await expect(
      page.getByText('Open Your Radix Wallet App to complete the request'),
    ).toBeVisible();

    // Cancel the request
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Login Request Pending')).not.toBeVisible();
  });

  test('Starknet: should show Starknet wallet modal', async ({ page }) => {
    await selectToken(page, 'starknet', /starknet SOL Starknet/);

    await page
      .getByRole('main')
      .getByRole('button', { name: 'Connect wallet', exact: true })
      .click();

    // Starknet modal
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Connect to' }),
    ).toBeVisible();

    // Wallet options shown as install links
    await expect(dialog.getByText('Install Braavos')).toBeVisible();
    await expect(
      dialog.getByText('Install Ready Wallet (formerly Argent)'),
    ).toBeVisible();

    // Close
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();
  });
});
