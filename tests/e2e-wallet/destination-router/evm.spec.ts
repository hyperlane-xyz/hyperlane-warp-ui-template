import { expect, test, type Page } from '@playwright/test';
import { MOCK_EVM_ADDRESS } from '../helpers/constants';
import { installEvmRpcMock, ROUTER_COLLATERAL_SEED } from '../helpers/evmRpc';
import { clickContinue, enterAmount, selectDestinationToken } from '../helpers/formFlow';
import { openE2EApp, waitForWarpRuntime } from '../helpers/page-setup';

const USDC_ETHEREUM = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const REMOTE_ADDRESS_RE = /0x[0-9a-fA-F]{40}/;

test.describe('EVM destination router selection', () => {
  async function captureRemoteAddress(page: Page, destPattern: RegExp) {
    await waitForWarpRuntime(page);
    await selectDestinationToken(page, destPattern);
    await enterAmount(page, '1');
    await clickContinue(page);
    // Gate on the Send button — only renders when isReview=true (validate
    // passed). The .transfer-review-panel element stays in DOM with max-h-0
    // even when isReview=false, so reading its text directly would silently
    // succeed on a validate failure.
    await expect(page.getByRole('button', { name: /Send to /i })).toBeVisible({
      timeout: 30_000,
    });
    // Then wait for fee quotes to settle — the panel renders a spinner while
    // isLoading=true, and the Transfer Remote section only mounts afterwards.
    const reviewPanel = page.locator('.transfer-review-panel').first();
    await expect(reviewPanel).toContainText(/Remote Token/i, { timeout: 30_000 });
    const text = await reviewPanel.innerText();
    return text.split('Remote Token')[1]?.match(REMOTE_ADDRESS_RE)?.[0];
  }

  const rpcConfig = {
    chainUrlMap: [
      { chainId: 1, urlMatch: /ethereum\.|eth\.drpc/i },
      { chainId: 8453, urlMatch: /base\.drpc|base\.org/i },
      { chainId: 42161, urlMatch: /arb1\.arbitrum|arbitrum\.rpc/i },
    ],
    erc20: {
      '*': { decimals: 6, defaultBalance: ROUTER_COLLATERAL_SEED },
      [`1:${USDC_ETHEREUM}`]: {
        decimals: 6,
        // Fixture lookup is first-match-wins, not a field merge (see
        // handleEthCall: erc20[key] ?? erc20[to] ?? erc20['*']) — once this
        // specific key resolves the '*' wildcard is ignored, so the seed
        // must be repeated here for owners other than MOCK_EVM_ADDRESS.
        defaultBalance: ROUTER_COLLATERAL_SEED,
        balances: { [MOCK_EVM_ADDRESS.toLowerCase()]: '0x3b9aca00' },
      },
    },
  };

  test('Base and Arbitrum destinations resolve distinct non-empty remote-token addresses', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await installEvmRpcMock(page, rpcConfig);
    await openE2EApp(page);
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 15_000 });
    const baseAddr = await captureRemoteAddress(page, /base USDC/i);
    expect(baseAddr).toMatch(REMOTE_ADDRESS_RE);
    expect(baseAddr).not.toMatch(/^0x0+$/);

    await openE2EApp(page);
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 15_000 });
    const arbAddr = await captureRemoteAddress(page, /arbitrum USDC/i);
    expect(arbAddr).toMatch(REMOTE_ADDRESS_RE);
    expect(arbAddr).not.toMatch(/^0x0+$/);
    expect(arbAddr).not.toBe(baseAddr);
  });
});
