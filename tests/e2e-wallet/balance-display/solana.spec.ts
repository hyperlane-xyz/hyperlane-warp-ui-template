import { expect, test } from '@playwright/test';
import { selectOriginToken } from '../helpers/formFlow';
import { openE2EApp, waitForWarpRuntime } from '../helpers/page-setup';
import { installSolanaRpcMock } from '../helpers/solanaRpc';

const USDC_MINT_SOLANAMAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

test.describe('Solana balance display', () => {
  test('renders mocked SPL balance for solanamainnet USDC in origin card', async ({ page }) => {
    await installSolanaRpcMock(page, {
      spl: {
        balancesByMint: {
          [USDC_MINT_SOLANAMAINNET]: '4321560000',
        },
      },
    });

    await openE2EApp(page);
    // The synchronous storeInit path seeds `tokens` as TokenMetadata — useBalance
    // short-circuits on those. Gate on the async WarpCore runtime upgrade so the
    // token we pick is a real Token instance with a getBalance method.
    await waitForWarpRuntime(page);
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 20_000 });

    await selectOriginToken(page, /solanamainnet USDC/i);

    const balance = page.locator('.transfer-balance').first();
    await expect(balance).toBeVisible({ timeout: 20_000 });
    // Balance is rendered with 4 decimal places (see TokenBalance) — use a
    // prefix match so an upstream display-format change surfaces as a clear
    // diff rather than a cryptic substring miss.
    await expect(balance).toContainText(/4321\.56\d* USDC/, { timeout: 20_000 });
  });
});
