import { expect, test } from '@playwright/test';
import { MOCK_EVM_ADDRESS } from '../helpers/constants';
import { installEvmRpcMock, ROUTER_COLLATERAL_SEED } from '../helpers/evmRpc';
import { searchAndSelectDestinationToken, searchAndSelectOriginToken } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

const USDC_ARBITRUM = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';
const USDC_ROUTER_ARBITRUM = '0x1FdA66FA15A261F01F1E09228D41bD0A806d7529';
const USDC_ROUTER_BASE = '0xB46930ca998587A95D9Ee000FA73A071ADD56B64';

test.describe('EVM same-symbol dedup', () => {
  test('selecting Arbitrum USDC keeps Base route destinations available', async ({ page }) => {
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

    await openE2EApp(page);
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 15_000 });

    await searchAndSelectOriginToken(page, USDC_ROUTER_ARBITRUM, /arbitrum USDC/i);
    await searchAndSelectDestinationToken(page, USDC_ROUTER_BASE, /base USDC/i);

    // The origin token field's accessible label includes the chain — must be
    // Arbitrum, not Ethereum.
    await expect(page.getByTestId('token-select-origin')).toContainText(/Arbitrum/i);
    await expect(page.getByTestId('token-select-origin')).not.toContainText(/Ethereum/i);
    await expect(page.getByTestId('token-select-destination')).toContainText(/Base/i);
    await expect(page.getByText('Route: bridge')).toBeVisible();
  });
});
