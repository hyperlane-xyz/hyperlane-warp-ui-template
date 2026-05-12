import { expect, test } from '@playwright/test';
import { selectOriginToken } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

// Deterministic Keypair.fromSeed(0xe2... ×32).publicKey shortened via
// shortenAddress() → "EY4LF...nwGi". Hard-coded so the assertion fails loudly
// if the seed or shortening scheme changes upstream.
const MOCK_SOLANA_SHORT = 'EY4LF...nwGi';

test.describe('Solana mock adapter: auto-connect', () => {
  test('connects to MockSolanaAdapter and renders the shortened pubkey', async ({ page }) => {
    await openE2EApp(page);

    // Switch origin to a Solana chain so the Solana wallet dropdown renders.
    await selectOriginToken(page, /solanamainnet USDC/i);

    // Assert the Solana mock's specific shortened pubkey is visible — the
    // previous generic `[1-9A-HJ-NP-Za-km-z]{3,}\.\.\.` matcher also matched
    // the EVM address (0xe2E...e2Ee) and silently passed even when Solana
    // never auto-connected.
    await expect(page.getByText(MOCK_SOLANA_SHORT).first()).toBeVisible({ timeout: 20_000 });
  });
});
