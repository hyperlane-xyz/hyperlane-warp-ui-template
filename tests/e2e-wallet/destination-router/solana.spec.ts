import { expect, test } from '@playwright/test';
import { selectDestinationToken, selectOriginTokenOnChain } from '../helpers/formFlow';
import { openE2EApp, waitForWarpRuntime } from '../helpers/page-setup';

test.describe('Solana destination router identity', () => {
  test('picking solanamainnet USDC → Base USDC leaves both chain labels pinned', async ({
    page,
  }) => {
    await openE2EApp(page);
    await waitForWarpRuntime(page);

    await selectOriginTokenOnChain(page, /solanamainnet Solana/i, /solanamainnet USDC Solana/i);
    await selectDestinationToken(page, /base USDC/i);

    await expect(page.getByTestId('token-select-origin')).toContainText(/Solana/i);
    await expect(page.getByTestId('token-select-destination')).toContainText(/Base/i);
    await expect(page.getByTestId('token-select-origin')).not.toContainText(/Base/i);
    await expect(page.getByTestId('token-select-destination')).not.toContainText(/^Solana/i);
  });
});
