import { expect, test } from '@playwright/test';
import { selectDestinationToken, selectOriginToken } from '../helpers/formFlow';
import { openE2EApp, waitForWarpRuntime } from '../helpers/page-setup';

test.describe('Solana destination router identity', () => {
  test('picking solanamainnet USDC → eclipsemainnet USDC leaves both chain labels pinned', async ({
    page,
  }) => {
    await openE2EApp(page);
    await waitForWarpRuntime(page);

    await selectOriginToken(page, /solanamainnet USDC/i);
    await selectDestinationToken(page, /eclipsemainnet USDC/i);

    await expect(page.getByTestId('token-select-origin')).toContainText(/Solana/i);
    await expect(page.getByTestId('token-select-destination')).toContainText(/Eclipse/i);
    // Negative checks: the labels must be chain-scoped, not a dedup'd
    // fallback to some other USDC.
    await expect(page.getByTestId('token-select-origin')).not.toContainText(/Eclipse/i);
    await expect(page.getByTestId('token-select-destination')).not.toContainText(/^Solana/i);
  });
});
