import { expect, test } from '@playwright/test';
import { openE2EApp } from '../helpers/page-setup';

test.describe('EVM mock connector: auto-connect', () => {
  test('connects to mock EVM wallet on page load', async ({ page }) => {
    await openE2EApp(page);
    // shortenAddress lowercases (first 5 + '...' + last 4), giving 0xe2e...e2ee.
    await expect(page.getByText('0xe2e...e2ee').first()).toBeVisible({ timeout: 20_000 });
  });
});
