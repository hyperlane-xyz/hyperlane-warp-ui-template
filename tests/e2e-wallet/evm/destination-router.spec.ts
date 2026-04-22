import { expect, test, type Page } from '@playwright/test';
import { MOCK_EVM_ADDRESS } from '../helpers/constants';
import { installEvmRpcMock } from '../helpers/evmRpc';
import { enterAmount, selectDestinationToken } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

const USDC_ETHEREUM = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const REMOTE_ADDRESS_RE = /0x[0-9a-fA-F]{40}/;

test.describe('EVM destination router selection', () => {
  async function captureRemoteAddress(page: Page, destPattern: RegExp) {
    await selectDestinationToken(page, destPattern);
    await enterAmount(page, '1');
    await page.getByRole('button', { name: /^Continue$/ }).click();
    const reviewPanel = page.locator('.transfer-review-panel').first();
    await expect(reviewPanel).toContainText(/Transfer Remote/i, { timeout: 30_000 });
    const text = await reviewPanel.innerText();
    return text.match(REMOTE_ADDRESS_RE)?.[0];
  }

  const rpcConfig = {
    chainUrlMap: [
      { chainId: 1, urlMatch: /ethereum\.|eth\.drpc/i },
      { chainId: 8453, urlMatch: /base\.drpc|base\.org/i },
      { chainId: 42161, urlMatch: /arb1\.arbitrum|arbitrum\.rpc/i },
    ],
    erc20: {
      [`1:${USDC_ETHEREUM}`]: {
        decimals: 6,
        balances: { [MOCK_EVM_ADDRESS.toLowerCase()]: '0x3b9aca00' },
      },
    },
  };

  test('Base destination resolves a non-empty remote-token address', async ({ page }) => {
    await installEvmRpcMock(page, rpcConfig);
    await openE2EApp(page);
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 15_000 });
    const addr = await captureRemoteAddress(page, /base USDC/i);
    expect(addr).toMatch(REMOTE_ADDRESS_RE);
    expect(addr).not.toMatch(/^0x0+$/);
  });

  test('Arbitrum destination resolves a different remote-token address than Base', async ({
    page,
  }) => {
    await installEvmRpcMock(page, rpcConfig);
    await openE2EApp(page);
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 15_000 });
    const arbAddr = await captureRemoteAddress(page, /arbitrum USDC/i);
    expect(arbAddr).toMatch(REMOTE_ADDRESS_RE);
    expect(arbAddr).not.toMatch(/^0x0+$/);
  });
});
