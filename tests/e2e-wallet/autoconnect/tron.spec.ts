import { expect, test } from '@playwright/test';
import { openE2EApp } from '../helpers/page-setup';

// MOCK_TRON_ADDRESS from src/features/wallet/_e2e/MockTronAdapter.ts. Not a
// real address; the adapter never broadcasts.
const MOCK_TRON_ADDRESS = 'TE2EE2EE2EE2EE2EE2EE2EE2EE2EE2EE2E';

test.describe('Tron mock adapter: auto-connect', () => {
  test('MockTronAdapter auto-connects and surfaces its address in the wallet dropdown', async ({
    page,
  }) => {
    await openE2EApp(page);

    // No Tron-origin warp routes ship in the published registry today, so the
    // origin picker can't surface a Tron token — we instead assert against
    // the "Connected Wallets" dropdown in the header, which lists every
    // auto-connected mock wallet once its adapter emits 'connect'.
    await page.getByRole('button', { name: /Wallets .*Connected/i }).click();

    // The button's accessible name concatenates the adapter's display name
    // with the connected address. Match the full MOCK_TRON_ADDRESS against
    // the expanded Connected Wallets listing.
    await expect(page.getByText(MOCK_TRON_ADDRESS)).toBeVisible({ timeout: 20_000 });
  });
});
