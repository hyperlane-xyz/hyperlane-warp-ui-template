import { expect, test } from '@playwright/test';
import { openE2EApp } from '../helpers/page-setup';

test.describe('Cosmos mock wallet: auto-connect', () => {
  test('connects to MockCosmosWallet and renders a shortened celestia bech32', async ({ page }) => {
    await openE2EApp(page);

    // Switch origin to a Cosmos-origin warp route (TIA on celestia). TIA is
    // not in the featured-tokens list, so the default picker view hides it
    // behind the search input — type the chain name to surface it.
    await page.getByTestId('token-select-origin').click();
    await page.getByText('Select Token').waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByLabel('Search tokens').fill('celestia');
    await page
      .getByRole('button', { name: /celestia TIA/i })
      .first()
      .click({ timeout: 30_000 });
    await page.getByText('Select Token').waitFor({ state: 'hidden', timeout: 30_000 });

    // Origin-card WalletDropdown flips from "Connect Wallet" to a shortened
    // address once the mock auto-connects. For celestia-prefixed bech32 that
    // is `celes...XXXX` (5 + '...' + 4, lowercased by shortenAddress).
    const shortened = page.getByText(/^celes\.\.\.[a-z0-9]{4}$/).first();
    await expect(shortened).toBeVisible({ timeout: 20_000 });
  });
});
