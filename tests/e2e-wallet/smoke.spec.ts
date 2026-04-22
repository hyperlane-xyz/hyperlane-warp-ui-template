import { expect, test } from '@playwright/test';
import { getE2EState } from './helpers/captured';
import { openE2EApp } from './helpers/page-setup';

test.describe('E2E wallet scaffolding smoke', () => {
  test('initializes __WARP_E2E__ global when ?_e2e=1 is set', async ({ page }) => {
    await openE2EApp(page);
    const state = await getE2EState(page);
    expect(state.readyAt).toBeGreaterThan(0);
    expect(state.evmTxs).toEqual([]);
    expect(state.solanaTxs).toEqual([]);
    expect(state.cosmosTxs).toEqual([]);
  });

  test('does not initialize the global without the gate', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });
    const state = await page.evaluate(() => window.__WARP_E2E__);
    expect(state).toBeUndefined();
  });
});
