import { test as base } from '@playwright/test';

import routes from './fixtures/available-routes.json';
import chains from './fixtures/chains.json';
import readiness from './fixtures/readiness.json';
import tokens from './fixtures/tokens.json';

const responses: Record<string, unknown> = { ...chains, ...tokens, ...routes, ...readiness };

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';

// Browser tests exercise the UI against a fixed router catalog. Live router
// requests timed out in CI and left the app in its fatal initialization state.
// Per-test routes registered later still override these defaults.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://hyperswaps-api.hyperlane.xyz/**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();

      const url = new URL(route.request().url());
      const key = `${url.pathname}${url.search}`;
      const response = responses[key];
      if (response === undefined) throw new Error(`Missing router API fixture: ${key}`);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
    await use(page);
  },
});
