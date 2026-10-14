import type { Page } from '@playwright/test';
import type { CapturedCosmosTx, CapturedEvmTx, CapturedSolanaTx, WarpE2EState } from './types';

declare global {
  interface Window {
    __WARP_E2E__?: WarpE2EState;
  }
}

export async function getE2EState(page: Page): Promise<WarpE2EState> {
  const state = await page.evaluate(() => window.__WARP_E2E__);
  if (!state) throw new Error('__WARP_E2E__ not initialized — did you call openE2EApp?');
  return state;
}

export async function getCapturedEvmTxs(page: Page): Promise<CapturedEvmTx[]> {
  return (await getE2EState(page)).evmTxs;
}

export async function getCapturedSolanaTxs(page: Page): Promise<CapturedSolanaTx[]> {
  return (await getE2EState(page)).solanaTxs;
}

export async function getCapturedCosmosTxs(page: Page): Promise<CapturedCosmosTx[]> {
  return (await getE2EState(page)).cosmosTxs;
}

export async function waitForCapturedEvmTx(page: Page, timeoutMs = 10_000): Promise<CapturedEvmTx> {
  await page.waitForFunction(() => (window.__WARP_E2E__?.evmTxs.length ?? 0) > 0, {
    timeout: timeoutMs,
  });
  const txs = await getCapturedEvmTxs(page);
  return txs[txs.length - 1];
}

export async function waitForCapturedSolanaTx(
  page: Page,
  timeoutMs = 10_000,
): Promise<CapturedSolanaTx> {
  await page.waitForFunction(() => (window.__WARP_E2E__?.solanaTxs.length ?? 0) > 0, {
    timeout: timeoutMs,
  });
  const txs = await getCapturedSolanaTxs(page);
  return txs[txs.length - 1];
}

export async function waitForCapturedCosmosTx(
  page: Page,
  timeoutMs = 10_000,
): Promise<CapturedCosmosTx> {
  await page.waitForFunction(() => (window.__WARP_E2E__?.cosmosTxs.length ?? 0) > 0, {
    timeout: timeoutMs,
  });
  const txs = await getCapturedCosmosTxs(page);
  return txs[txs.length - 1];
}
