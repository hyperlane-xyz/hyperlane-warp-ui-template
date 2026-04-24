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

    const shortened = page.getByText('0x07e...E2E2').first();
    await expect(shortened).toBeVisible({ timeout: 5_000 });
  });
});
