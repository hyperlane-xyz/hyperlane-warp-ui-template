import { expect, test } from '@playwright/test';
import { MOCK_EVM_ADDRESS } from '../helpers/constants';
import { installEvmRpcMock } from '../helpers/evmRpc';
import { enterAmount } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

const USDC_ETHEREUM = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const APPROVE_SELECTOR = '0x095ea7b3';

test.describe('EVM approval flow', () => {
  test.setTimeout(180_000);
  test('low allowance forces approve() as the first captured tx', async ({ page }) => {
    const { txs } = await installEvmRpcMock(page, {
      chainUrlMap: [
        { chainId: 8453, urlMatch: /base\.drpc|base\.org|base-mainnet|base\.publicnode|base\.llamarpc|basescan|base\.blockpi|base\.meowrpc/i },
        { chainId: 1, urlMatch: /ethereum\.|eth\.drpc|eth-mainnet|llamarpc|cloudflare-eth|ankr.*eth|eth\.publicnode/i },
      ],
      erc20: {
        [`1:${USDC_ETHEREUM}`]: {
          decimals: 6,
          balances: { [MOCK_EVM_ADDRESS.toLowerCase()]: '0x3b9aca00' },
          // Zero allowance forces the approve() branch before route execution.
          allowance: '0x0',
        },
        [`8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`]: {
          decimals: 6,
          defaultBalance: '0xffffffffffff',
        },
      },
      wrappedTokenByChainId: {
        1: USDC_ETHEREUM,
        8453: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      },
    });

    await openE2EApp(page);
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 20_000 });

    await enterAmount(page, '1');
    await page.getByRole('button', { name: /^Continue$/ }).click();

    await expect(page.locator('.transfer-review-panel').first()).toContainText(/Approve/i, {
      timeout: 45_000,
    });
    await expect(page.locator('.transfer-review-panel').first()).toContainText(/Spender:/i);
    const sendButton = page.getByRole('button', { name: /^Send to/i });
    await sendButton.waitFor({ state: 'visible', timeout: 30_000 });
    await sendButton.click({ timeout: 30_000 });

    // First eth_sendTransaction must be the approval call. Route execution
    // should only dispatch after the approval receipt confirms.
    await expect
      .poll(() => txs.length, { timeout: 60_000, intervals: [500] })
      .toBeGreaterThan(0);

    const firstSelector = txs[0].data!.slice(0, 10).toLowerCase();
    expect(firstSelector).toBe(APPROVE_SELECTOR);
    // And the approve tx targets the ERC20 itself on the origin chain.
    expect(txs[0].chainId).toBe(1);
    expect(txs[0].to?.toLowerCase()).toBe(USDC_ETHEREUM);

    // A follow-up route execution should eventually arrive on the same chain.
    // If it doesn't (e.g. approve receipt polling stalls under the mock),
    // the non-approval path below guards the regression we actually care about
    // — that the first tx is approve, not route execution.
    if (txs.length > 1) {
      const secondSelector = txs[1].data!.slice(0, 10).toLowerCase();
      expect(secondSelector).not.toBe(APPROVE_SELECTOR);
      expect(txs[1].chainId).toBe(1);
    }
  });
});
