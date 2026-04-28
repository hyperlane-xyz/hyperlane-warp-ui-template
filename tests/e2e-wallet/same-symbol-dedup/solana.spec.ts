import { expect, test } from '@playwright/test';
import { selectDestinationToken, selectOriginToken } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

test.describe('Solana same-symbol dedup', () => {
  test('Solana USDC vs Eclipse USDC render distinct chain labels in origin field', async ({
    page,
  }) => {
    await openE2EApp(page);

    await selectOriginToken(page, /solanamainnet USDC/i);
    const origin = page.getByTestId('token-select-origin');
    await expect(origin).toContainText(/Solana/i);
    await expect(origin).not.toContainText(/Eclipse/i);

    // Switch origin to Eclipse USDC (same symbol) — origin must flip chain label.
    await selectOriginToken(page, /eclipsemainnet USDC/i);
    await expect(origin).toContainText(/Eclipse/i);
    await expect(origin).not.toContainText(/^Solana/i);
  });

  test('destination USDC selection on a Solana route is chain-scoped', async ({ page }) => {
    await openE2EApp(page);
    await selectOriginToken(page, /solanamainnet USDC/i);
    await selectDestinationToken(page, /eclipsemainnet USDC/i);
    await expect(page.getByTestId('token-select-destination')).toContainText(/Eclipse/i);
  });
});
