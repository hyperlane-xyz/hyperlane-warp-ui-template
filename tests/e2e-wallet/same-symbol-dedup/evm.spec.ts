import { expect, test } from '@playwright/test';
import { MOCK_EVM_ADDRESS } from '../helpers/constants';
import { installEvmRpcMock, ROUTER_COLLATERAL_SEED } from '../helpers/evmRpc';
import { enterAmount, selectDestinationToken, selectOriginToken } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';
import { installQuoteMock } from '../helpers/quote';

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
        '*': { decimals: 6, defaultBalance: ROUTER_COLLATERAL_SEED },
        [`42161:${USDC_ARBITRUM}`]: {
          decimals: 6,
          // Fixture lookup is first-match-wins, not a field merge (see
          // handleEthCall: erc20[key] ?? erc20[to] ?? erc20['*']) — once this
          // specific key resolves the '*' wildcard is ignored, so the seed
          // must be repeated here for owners other than MOCK_EVM_ADDRESS.
          defaultBalance: ROUTER_COLLATERAL_SEED,
          balances: { [MOCK_EVM_ADDRESS.toLowerCase()]: '0x3b9aca00' }, // 1000 USDC
        },
      },
    });
    await installQuoteMock(page, { approval: 'none' });

    await openE2EApp(page);
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 15_000 });

    await selectOriginToken(page, /arbitrum USDC/i);
    await selectDestinationToken(page, /base USDC/i);
    // The origin token field's accessible label includes the chain — must be
    // Arbitrum, not Ethereum.
    await expect(page.getByTestId('token-select-origin')).toContainText(/Arbitrum/i);
    await expect(page.getByTestId('token-select-origin')).not.toContainText(/Ethereum/i);

    await enterAmount(page, '1');
    await page.getByRole('button', { name: /^Continue$/ }).click();

    // Gate on the Send button — only renders when isReview=true (validate
    // passed). The .transfer-review-panel element stays in DOM with max-h-0
    // even when isReview=false, so checking its text directly would silently
    // succeed on a validate failure and miss the regression below.
    await expect(page.getByRole('button', { name: /Send to /i })).toBeVisible({
      timeout: 30_000,
    });

    const reviewPanel = page.locator('.transfer-review-panel').first();
    await expect(reviewPanel).toContainText(/Output Token/i, { timeout: 30_000 });

    // Review panel populating with an output token proves the route resolved
    // against the Arbitrum-scoped USDC.
    await expect(reviewPanel).toContainText(/Transaction 1: Transfer/i);
    await expect(reviewPanel).toContainText(/1 USDC/);
    // Remote token must render as a 0x-address (non-empty, not a fallback string).
    await expect(reviewPanel).toContainText(/0x[0-9a-fA-F]{40}/);
  });
});
