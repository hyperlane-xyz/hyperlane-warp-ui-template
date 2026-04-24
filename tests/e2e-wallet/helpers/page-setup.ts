import type { Page } from '@playwright/test';

const DEFAULT_BASE = 'http://localhost:3000';

export interface OpenE2EAppOptions {
  path?: string;
  extraQuery?: Record<string, string>;
}

export async function openE2EApp(page: Page, opts: OpenE2EAppOptions = {}): Promise<void> {
  const path = opts.path ?? '/';
  const params = new URLSearchParams({ _e2e: '1', ...(opts.extraQuery ?? {}) });
  await page.goto(`${DEFAULT_BASE}${path}?${params.toString()}`);
  await page.waitForFunction(() => Boolean(window.__WARP_E2E__));
}

// Blocks until the async WarpCore runtime has replaced the synchronous
// TokenMetadata entries in the store. Gate on this before interacting with
// anything that calls token.getBalance (origin/destination balance cards,
// review-panel route lookups).
export async function waitForWarpRuntime(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(() => Boolean(window.__WARP_E2E__?.isRuntimeReady), null, {
    timeout: timeoutMs,
  });
}
