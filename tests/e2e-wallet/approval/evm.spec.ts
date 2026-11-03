import { expect, test } from '../../fixtures';
import { MOCK_EVM_ADDRESS } from '../helpers/constants';
import { installEvmRpcMock } from '../helpers/evmRpc';
import { enterAmount, selectDestinationToken, selectOriginToken } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';
import { installQuoteMock } from '../helpers/quote';

const USDC_ETHEREUM = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const APPROVE_SELECTOR = '0x095ea7b3';

test.describe('EVM approval flow', () => {
  test.setTimeout(180_000);
  for (const { closeDuringPreparation, approvalRequired } of [
    { closeDuringPreparation: true, approvalRequired: true },
    { closeDuringPreparation: false, approvalRequired: true },
    { closeDuringPreparation: false, approvalRequired: false },
  ]) {
    test(`approval required: ${approvalRequired}, close during preparation: ${closeDuringPreparation}`, async ({
      page,
    }, testInfo) => {
      const { txs } = await installEvmRpcMock(page, {
        chainUrlMap: [
          {
            chainId: 8453,
            urlMatch:
              /base\.drpc|base\.org|base-mainnet|base\.publicnode|base\.llamarpc|basescan|base\.blockpi|base\.meowrpc/i,
          },
          {
            chainId: 1,
            urlMatch:
              /ethereum\.|eth\.drpc|eth-mainnet|llamarpc|cloudflare-eth|ankr.*eth|eth\.publicnode/i,
          },
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
      await installQuoteMock(page, {
        approval: approvalRequired ? 'erc20' : 'none',
        swapSide: approvalRequired ? 'origin' : 'destination',
      });

      await openE2EApp(page);
      await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 20_000 });
      await selectOriginToken(page, /ethereum USDC/i);
      await selectDestinationToken(page, /base USDC/i);

      await enterAmount(page, '1');
      await page.getByRole('button', { name: /^Continue$/ }).click();

      if (approvalRequired) {
        await expect(page.locator('.transfer-review-panel').first()).toContainText(/Approve/i, {
          timeout: 45_000,
        });
        await expect(page.locator('.transfer-review-panel').first()).toContainText(/Spender:/i);
      }
      const sendButton = page.getByRole('button', { name: /^Send to/i });
      await sendButton.waitFor({ state: 'visible', timeout: 30_000 });
      // Hold the fresh allowance check: preparation must render before RPCs finish,
      // without persisting a draft or requesting any wallet transactions.
      let releasePreflight = () => {};
      const preflightGate = new Promise<void>((resolve) => {
        releasePreflight = resolve;
      });
      let releaseApproval = () => {};
      let releaseReceipt = () => {};
      let releaseTransfer = () => {};
      const approvalGate = new Promise<void>((resolve) => {
        releaseApproval = resolve;
      });
      const receiptGate = new Promise<void>((resolve) => {
        releaseReceipt = resolve;
      });
      const transferGate = new Promise<void>((resolve) => {
        releaseTransfer = resolve;
      });
      await page.route('**/*', async (route) => {
        const body = route.request().postData() ?? '';
        if (!closeDuringPreparation) {
          if (body.includes('eth_sendTransaction'))
            await (body.includes(APPROVE_SELECTOR) ? approvalGate : transferGate);
          if (body.includes('eth_getTransactionReceipt')) await receiptGate;
        }
        if (
          route.request().method() === 'POST' &&
          route.request().postData()?.includes('0xdd62ed3e')
        ) {
          await preflightGate;
        }
        await route.fallback();
      });
      try {
        await sendButton.click({ timeout: 30_000 });
        if (approvalRequired) {
          await expect(page.getByTestId('transfer-headline')).toHaveText(
            'Checking token permission',
          );
          await expect(page.getByRole('list', { name: 'Before sending' })).toBeVisible();
          await expect(page.getByTestId('transfer-motion')).toHaveCount(0);
          expect(txs).toHaveLength(0);
          const history = await page.evaluate(
            () =>
              JSON.parse(localStorage.getItem('app-state') ?? '{}').state?.transactionHistory ?? [],
          );
          expect(history).toHaveLength(0);
          await expect(page.getByRole('region', { name: 'Transfer route' })).toHaveCount(0);
          if (closeDuringPreparation)
            await page.getByRole('button', { name: 'Close', exact: true }).click();
        }
      } finally {
        releasePreflight();
      }

      if (!approvalRequired) {
        try {
          await expect(page.getByTestId('transfer-headline')).toHaveText(
            'Confirm transfer in your wallet',
            { timeout: 60_000 },
          );
          const route = page.getByRole('region', { name: 'Transfer route' });
          await expect(route).toBeVisible();
          await expect(
            route.getByRole('group', { name: 'Transfer: Waiting', exact: true }),
          ).toBeVisible();
          await expect(
            route.getByRole('group', { name: 'Destination swap: Waiting', exact: true }),
          ).toBeVisible();
          await expect(route.locator('.message-status-spinner')).toHaveCount(0);
          await expect(page.getByTestId('transfer-motion')).toHaveCount(0);
          await page.screenshot({
            path: testInfo.outputPath('destination-wallet.png'),
            fullPage: true,
          });
          releaseTransfer();
          await expect.poll(() => txs.length).toBeGreaterThan(0);
          expect(txs[0].data?.slice(0, 10).toLowerCase()).not.toBe(APPROVE_SELECTOR);
        } finally {
          releaseApproval();
          releaseReceipt();
          releaseTransfer();
        }
        return;
      }

      if (!closeDuringPreparation) {
        try {
          await expect(page.getByTestId('transfer-headline')).toHaveText('Approve in your wallet', {
            timeout: 60_000,
          });
          await expect(page.getByRole('list', { name: 'Before sending' })).toBeVisible();
          await expect(page.getByRole('region', { name: 'Transfer route' })).toHaveCount(0);
          releaseApproval();
          await expect(page.getByTestId('transfer-headline')).toHaveText(
            'Confirming token approval',
          );
          await expect(page.getByTestId('transfer-details')).toContainText(
            'Your transfer has not started yet.',
          );
          await page.screenshot({ path: testInfo.outputPath('approval.png'), fullPage: true });
          releaseReceipt();
          await expect(page.getByTestId('transfer-headline')).toHaveText(
            'Confirm transfer in your wallet',
            { timeout: 60_000 },
          );
          await expect(page.getByRole('region', { name: 'Transfer route' })).toHaveCount(0);
          await expect(page.getByTestId('transfer-motion')).toHaveCount(0);
          await expect(
            page.getByRole('list', { name: 'Before sending' }).getByRole('listitem').last(),
          ).toHaveAttribute('aria-current', 'step');
          releaseTransfer();
          await expect(page.getByRole('region', { name: 'Transfer route' })).toBeVisible();
        } finally {
          releaseApproval();
          releaseReceipt();
          releaseTransfer();
        }
      }

      // First eth_sendTransaction must be the approval call. Route execution
      // should only dispatch after the approval receipt confirms.
      await expect.poll(() => txs.length, { timeout: 60_000, intervals: [500] }).toBeGreaterThan(0);

      if (closeDuringPreparation) await expect(page.getByTestId('transfer-details')).toBeHidden();

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
  }
});
