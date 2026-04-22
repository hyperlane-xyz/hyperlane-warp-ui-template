import { expect, test } from '@playwright/test';
import { openE2EApp } from '../helpers/page-setup';

test.describe('Starknet mock connector: auto-connect', () => {
  test('connects to MockStarknetConnector and renders a shortened address', async ({ page }) => {
    await openE2EApp(page, {
      extraQuery: {
        origin: 'starknet',
        originToken: 'SOL',
      },
    });

    // Origin-card WalletDropdown flips from "Connect Wallet" to the shortened
    // address once MockStarknetConnector auto-connects. No manual click.
    const sendSection = page.getByText('Send').first().locator('../..');
    await expect(sendSection.getByText('Connect Wallet')).toBeHidden({ timeout: 20_000 });

    // Starknet hex address is 32 bytes, rendered lowercase by shortenAddress
    // (no capitalize flag in WalletDropdown). MOCK_STARKNET_ADDRESS starts
    // `0x07e2…e2e2`, giving shortened `0x07e...e2e2` — match the prefix and
    // 4-char tail shape.
    const shortened = page.getByText(/^0x07e\.\.\.[a-f0-9]{4}$/i).first();
    await expect(shortened).toBeVisible({ timeout: 5_000 });
  });
});
