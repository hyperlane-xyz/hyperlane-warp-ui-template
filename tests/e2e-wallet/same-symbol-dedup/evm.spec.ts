import { expect, test } from '@playwright/test';
import { MOCK_EVM_ADDRESS } from '../helpers/constants';
import { installEvmRpcMock } from '../helpers/evmRpc';
import { enterAmount, selectOriginToken } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

const USDC_ARBITRUM = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

test.describe('EVM same-symbol dedup', () => {
  test('selecting Arbitrum USDC resolves the Arbitrum-scoped route (not Ethereum)', async ({
    page,
  }) => {
    await installEvmRpcMock(page, {
      chainUrlMap: [
        { chainId: 1, urlMatch: /ethereum\.|eth\.drpc|eth-mainnet/i },
        { chainId: 8453, urlMatch: /base\.drpc|base\.org|base-mainnet/i },
        { chainId: 42161, urlMatch: /arb1\.arbitrum|arbitrum\.rpc|arbitrum-mainnet/i },
      ],
      erc20: {
        [`42161:${USDC_ARBITRUM}`]: {
          decimals: 6,
          balances: { [MOCK_EVM_ADDRESS.toLowerCase()]: '0x3b9aca00' }, // 1000 USDC
        },
      },
    });

    await openE2EApp(page);
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 15_000 });

    await selectOriginToken(page, /arbitrum USDC/i);
    // The origin token field's accessible label includes the chain — must be
    // Arbitrum, not Ethereum.
    await expect(page.getByTestId('token-select-origin')).toContainText(/Arbitrum/i);
    await expect(page.getByTestId('token-select-origin')).not.toContainText(/Ethereum/i);

    await enterAmount(page, '1');
    await page.getByRole('button', { name: /^Continue$/ }).click();

    // Review panel populating with the Transfer Remote section proves the
    // route resolved against the Arbitrum-scoped USDC (a failed dedup would
    // surface a validation error or a different remote token address here).
    const reviewPanel = page.locator('.transfer-review-panel').first();
    await expect(reviewPanel).toContainText(/Transfer Remote/i, { timeout: 30_000 });
    await expect(reviewPanel).toContainText(/1 USDC/);
    // Remote token must render as a 0x-address (non-empty, not a fallback string).
    await expect(reviewPanel).toContainText(/0x[0-9a-fA-F]{40}/);
  });
});
