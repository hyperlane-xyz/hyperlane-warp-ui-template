import { expect, test } from '@playwright/test';
import { selectDestinationToken, selectOriginTokenOnChain } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

test.describe('Solana token chain scoping', () => {
  test('Solana USDC origin stays chain-scoped when paired with Base USDC', async ({ page }) => {
    await openE2EApp(page);

    await selectOriginTokenOnChain(page, /solanamainnet Solana/i, /solanamainnet USDC Solana/i);
    const origin = page.getByTestId('token-select-origin');
    await expect(origin).toContainText(/Solana/i);
    await expect(origin).not.toContainText(/Base/i);

    await selectDestinationToken(page, /base USDC/i);
    await expect(page.getByTestId('token-select-destination')).toContainText(/Base/i);
  });
});
