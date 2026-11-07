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
  for (const { closeDuringPreparation, approvalRequired, sdkBridge, expiredQuote = false } of [
    { closeDuringPreparation: true, approvalRequired: true, sdkBridge: false },
    { closeDuringPreparation: false, approvalRequired: true, sdkBridge: false },
    { closeDuringPreparation: false, approvalRequired: true, sdkBridge: true },
    { closeDuringPreparation: false, approvalRequired: false, sdkBridge: false },
    { closeDuringPreparation: false, approvalRequired: false, sdkBridge: true },
    { closeDuringPreparation: false, approvalRequired: true, sdkBridge: false, expiredQuote: true },
  ]) {
    test(`SDK bridge: ${sdkBridge}, approval required: ${approvalRequired}, close during preparation: ${closeDuringPreparation}, expired quote: ${expiredQuote}`, async ({
      page,
    }) => {
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
        expiresInSeconds: expiredQuote ? 8 : 60,
        approval: approvalRequired ? 'erc20' : 'none',
        sdkBridge,
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
        if (!sdkBridge)
          await expect(page.locator('.transfer-review-panel').first()).toContainText(/Spender:/i);
      }
      const sendButton = page.getByRole('button', { name: /^Send to/i });
      await sendButton.waitFor({ state: 'visible', timeout: 30_000 });
      if (expiredQuote) {
        // Review stays within the 10-second cache window, but its quote has expired.
        await page.clock.setFixedTime(new Date((await page.evaluate(() => Date.now())) + 9_000));
        await sendButton.click();
        await expect(page.getByTestId('transfer-submit')).toHaveText(
          'Quote has expired — refresh to continue',
        );
        expect(txs).toHaveLength(0);
        return;
      }

      // An older review must refresh; a fresh review must reach the wallet while reads are held.
      if (closeDuringPreparation) {
        await page.clock.setFixedTime(new Date((await page.evaluate(() => Date.now())) + 11_000));
      }

      // Hold allowance and route fee checks to distinguish cached review from revalidation.
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
          (body.includes('0xdd62ed3e') ||
            (body.includes('eth_estimateGas') && body.includes('0x12345678')))
        ) {
          await preflightGate;
        }
        await route.fallback();
      });
      try {
        await sendButton.click({ timeout: 30_000 });
        if (approvalRequired) {
          await expect(page.getByTestId('transfer-headline')).toHaveText(
            closeDuringPreparation ? 'Checking token permission' : 'Approve in your wallet',
          );
          await expect(page.getByRole('list', { name: 'Before sending' })).toBeVisible();
          await expect(page.getByTestId('transfer-motion')).toHaveCount(0);
          expect(txs).toHaveLength(0);
          const history = await page.evaluate(
            () =>
              JSON.parse(localStorage.getItem('app-state') ?? '{}').state?.transactionHistory ?? [],
          );
          expect(history).toHaveLength(closeDuringPreparation ? 0 : 1);
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
          if (!sdkBridge)
            await expect(
              route.getByRole('group', { name: 'Destination swap: Waiting', exact: true }),
            ).toBeVisible();
          else await expect(route.locator('.hyperswap-step')).toHaveCount(1);
          await expect(route.locator('.message-status-spinner')).toHaveCount(0);
          await expect(page.getByTestId('transfer-motion')).toHaveCount(0);
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
          const history = await page.evaluate(
            () => JSON.parse(localStorage.getItem('app-state') ?? '{}').state.transactionHistory,
          );
          expect(history).toHaveLength(1);
          expect(history[0].data.status).toBe('confirming-approve');
          expect(history[0].data.originTxHash).toBeUndefined();
          expect(txs).toHaveLength(1);
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
      await expect.poll(() => txs.length, { timeout: 60_000, intervals: [500] }).toBe(2);

      if (closeDuringPreparation) await expect(page.getByTestId('transfer-details')).toBeHidden();

      const firstSelector = txs[0].data!.slice(0, 10).toLowerCase();
      expect(firstSelector).toBe(APPROVE_SELECTOR);
      // And the approve tx targets the ERC20 itself on the origin chain.
      expect(txs[0].chainId).toBe(1);
      expect(txs[0].to?.toLowerCase()).toBe(USDC_ETHEREUM);

      const secondSelector = txs[1].data!.slice(0, 10).toLowerCase();
      expect(secondSelector).not.toBe(APPROVE_SELECTOR);
      expect(txs[1].chainId).toBe(1);
    });
  }
});
