import { expect, test } from '@playwright/test';
import { openE2EApp } from '../helpers/page-setup';

test.describe('Cosmos mock wallet: auto-connect', () => {
  test('connects to MockCosmosWallet and renders a shortened celestia bech32', async ({ page }) => {
    await openE2EApp(page);

    // Switch origin to a Cosmos-origin token. Type the chain name to surface
    // it through engine token search.
    await page.getByTestId('token-select-origin').click();
    await page.getByText('Select Token').waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByLabel('Search tokens').fill('celestia');
    await page
      .getByRole('button', { name: /celestia TIA/i })
      .first()
      .click({ timeout: 30_000 });
    await page.getByText('Select Token').waitFor({ state: 'hidden', timeout: 30_000 });

    // Pinned from the fixed mnemonic re-encoded with the `celestia` prefix.
    const shortened = page.getByText('celes...ud9c').first();
    await expect(shortened).toBeVisible({ timeout: 20_000 });
  });
});
