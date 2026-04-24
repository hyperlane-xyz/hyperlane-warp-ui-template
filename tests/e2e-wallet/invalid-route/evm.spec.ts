import { expect, test } from '@playwright/test';
import { installEvmRpcMock } from '../helpers/evmRpc';
import { getCapturedEvmTxs } from '../helpers/captured';
import { openE2EApp } from '../helpers/page-setup';

test.describe('EVM invalid route / amount', () => {
  test('submit is blocked when amount is 0 (no tx captured)', async ({ page }) => {
    const { txs } = await installEvmRpcMock(page, {
      chainUrlMap: [
        { chainId: 1, urlMatch: /ethereum\.|eth\.drpc/i },
        { chainId: 8453, urlMatch: /base\.drpc|base\.org/i },
      ],
    });
    await openE2EApp(page);

    // Wait for auto-connect to settle so submit button is live.
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 15_000 });

    // Click Continue with the empty default amount.
    await page.getByRole('button', { name: /^Continue$/ }).click();

    // ConnectAwareSubmitButton swaps its content to the first form error.
    await expect(
      page.getByRole('button', { name: /Invalid amount/i }),
    ).toBeVisible({ timeout: 5_000 });

    // No RPC-side eth_sendTransaction should have fired, and the window capture
    // must be empty.
    expect(txs).toHaveLength(0);
    expect(await getCapturedEvmTxs(page)).toHaveLength(0);
  });
});
