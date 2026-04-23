import { expect, test } from '@playwright/test';
import { MOCK_EVM_ADDRESS } from '../helpers/constants';
import { installEvmRpcMock } from '../helpers/evmRpc';
import { enterAmount } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

const USDC_ETHEREUM = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

// transferRemote overloads on Hyperlane TokenRouter / HypERC20.
const TRANSFER_REMOTE_SELECTORS = [
  '0x81b4e8b4', // transferRemote(uint32,bytes32,uint256)
  '0x51debffc', // transferRemote(uint32,bytes32,uint256,bytes,address)
  '0xb96da154', // transferRemote(uint32,bytes32,uint256,uint256)
];
test.describe('EVM tx payload capture', () => {
  // Full review + send flow needs extra time for fee resolution and tx confirmation.
  test.setTimeout(180_000);
  test('default Ethereum→Base USDC Send emits an on-chain tx with correct chain + selector', async ({
    page,
  }) => {
    const { txs } = await installEvmRpcMock(page, {
      chainUrlMap: [
        { chainId: 8453, urlMatch: /base\.drpc|base\.org|base-mainnet|base\.publicnode|base\.llamarpc|basescan|base\.blockpi|base\.meowrpc/i },
        { chainId: 1, urlMatch: /ethereum\.|eth\.drpc|eth-mainnet|llamarpc|cloudflare-eth|ankr.*eth|eth\.publicnode/i },
      ],
      erc20: {
        [`1:${USDC_ETHEREUM}`]: {
          decimals: 6,
          balances: { [MOCK_EVM_ADDRESS.toLowerCase()]: '0x3b9aca00' }, // 1000 USDC
        },
        [`8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`]: {
          decimals: 6,
          defaultBalance: '0xffffffffffff', // plenty of collateral
        },
      },
      // HypCollateral.wrappedToken() — returns the underlying USDC mint so
      // the adapter's getBalance goes through our USDC fixture.
      wrappedTokenByChainId: {
        1: USDC_ETHEREUM,
        8453: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      },
    });

    await openE2EApp(page);
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 20_000 });

    await enterAmount(page, '1');
    await page.getByRole('button', { name: /^Continue$/ }).click();

    // Review panel ready.
    await expect(page.locator('.transfer-review-panel').first()).toContainText(
      /Transfer Remote/i,
      { timeout: 45_000 },
    );

    const sendButton = page.getByRole('button', { name: /^Send to/i });
    await sendButton.waitFor({ state: 'visible', timeout: 30_000 });
    await sendButton.click({ timeout: 30_000 });

    // eth_sendTransaction reaches the RPC mock.
    await expect
      .poll(() => txs.length, { timeout: 60_000, intervals: [500] })
      .toBeGreaterThan(0);

    const captured = txs[txs.length - 1];
    expect(captured.chainId).toBe(1);
    expect(captured.to).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(captured.data).toBeDefined();
    const selector = captured.data!.slice(0, 10).toLowerCase();
    expect(TRANSFER_REMOTE_SELECTORS).toContain(selector);
  });
});
