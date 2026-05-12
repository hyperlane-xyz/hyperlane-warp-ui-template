import { expect, test } from '@playwright/test';
import { openE2EApp } from '../helpers/page-setup';

// MOCK_RADIX_ADDRESS from src/features/wallet/_e2e/E2EAutoConnectRadix.tsx.
// Deterministic, never broadcasted.
const MOCK_RADIX_ADDRESS =
  'account_rdx12e2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee';

test.describe('Radix mock wallet: auto-connect', () => {
  test('seeded Radix account surfaces in the Connected Wallets sidebar', async ({ page }) => {
    await openE2EApp(page);

    // E2EAutoConnectRadix seeds the widgets-managed Radix AccountContext on
    // mount. There is no dedicated Radix UI in the transfer form until a
    // Radix-origin token is selected, so validate against the global
    // Connected Wallets dropdown — a browser-level proof that the seeded
    // state reaches the app surface.
    await page.getByRole('button', { name: /Wallets .*Connected/i }).click();
    await expect(page.getByText(MOCK_RADIX_ADDRESS)).toBeVisible({ timeout: 20_000 });
  });

  test('selecting a Radix-origin token flips origin WalletDropdown off "Connect Wallet"', async ({
    page,
  }) => {
    await openE2EApp(page);

    await page.getByTestId('token-select-origin').click();
    await page.getByText('Select Token').waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByLabel('Search tokens').fill('radix');
    await page
      .getByRole('button', { name: /radix hSOL/i })
      .first()
      .click({ timeout: 30_000 });
    await page.getByText('Select Token').waitFor({ state: 'hidden', timeout: 30_000 });

    const sendSection = page.getByText('Send').first().locator('../..');
    await expect(sendSection.getByText('Connect Wallet')).toBeHidden({ timeout: 20_000 });
  });
});
