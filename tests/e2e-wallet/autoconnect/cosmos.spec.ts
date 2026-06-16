import { expect, test } from '@playwright/test';
import { searchAndSelectOriginToken } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

test.describe('Cosmos mock wallet: auto-connect', () => {
  test('connects to MockCosmosWallet and renders a shortened celestia bech32', async ({ page }) => {
    await openE2EApp(page);

    // Switch origin to a Cosmos-origin warp route (TIA on celestia). TIA is
    // not in the featured-tokens list, so the default picker view hides it
    // behind the search input — type the chain name to surface it.
    await searchAndSelectOriginToken(page, 'celestia', /celestia TIA/i);

    // Pinned from the fixed mnemonic re-encoded with the `celestia` prefix.
    const shortened = page.getByText('celes...ud9c').first();
    await expect(shortened).toBeVisible({ timeout: 20_000 });
  });
});
