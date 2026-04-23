import { expect, test } from '@playwright/test';
import { MOCK_EVM_ADDRESS } from '../helpers/constants';
import { installEvmRpcMock } from '../helpers/evmRpc';
import { selectOriginToken } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

test.describe('EVM balance display', () => {
  test('renders mocked ERC20 balance in transfer form', async ({ page }) => {
    await installEvmRpcMock(page, {
      chainUrlMap: [
        { chainId: 1, urlMatch: /ethereum\.|eth\.drpc|eth-mainnet|cloudflare-eth/i },
        { chainId: 8453, urlMatch: /base\.drpc|base\.org|base-mainnet/i },
      ],
      erc20: {
        // Use a wildcard fallback here because current main can surface
        // different Ethereum USDC route-token contracts while still routing to
        // the same origin-chain UI slot we care about.
        '*': {
          decimals: 6,
          // 1234.567890 USDC = 1_234_567_890 raw (6 decimals) → 0x499602d2
          balances: {
            [MOCK_EVM_ADDRESS.toLowerCase()]: '0x499602d2',
          },
        },
      },
    });

    await openE2EApp(page);
    await selectOriginToken(page, /ethereum USDC/i);

    // The .transfer-balance element should eventually show the mocked balance.
    const balance = page.locator('.transfer-balance').first();
    await expect(balance).toBeVisible({ timeout: 20_000 });
    await expect(balance).toContainText('1234.5679 USDC', { timeout: 20_000 });
  });
});
