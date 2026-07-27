// spec: specs/plan.md
// seed: tests/page-load/transfer-form-visible.spec.ts

import { test, expect } from '@playwright/test';
import { getOriginTokenButton, getDestinationTokenButton } from '../helpers/locators';

test.describe('Page Load - Query Param Token Override', () => {
  test('should use query params to set origin and destination tokens', async ({ page }) => {
    // 1. Navigate to app with address-based engine token params.
    await page.goto(
      'http://localhost:3000?origin=base&originToken=0x0000000000000000000000000000000000000000&destination=ethereum&destinationToken=0x0000000000000000000000000000000000000000',
    );

    // 2. Wait for 'Send' text visible
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // 3. Verify origin chain.
    await expect(getOriginTokenButton(page)).toHaveAttribute('data-chain', 'base');

    // 4. Verify destination chain.
    await expect(getDestinationTokenButton(page)).toHaveAttribute('data-chain', 'ethereum');

    // 5. Verify page.url() includes 'origin=base'
    await expect(page).toHaveURL(/origin=base/);
  });

  test('should handle invalid query params gracefully', async ({ page }) => {
    await page.goto(
      'http://localhost:3000?origin=nonexistent&originToken=FAKE&destination=nonexistent&destinationToken=FAKE',
    );
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    const originButton = getOriginTokenButton(page);
    await expect(originButton).toBeVisible();
    await expect(originButton).not.toHaveAttribute('data-chain');
    await expect(originButton).toContainText('Select token');

    const destButton = getDestinationTokenButton(page);
    await expect(destButton).toBeVisible();
    await expect(destButton).not.toHaveAttribute('data-chain');
    await expect(destButton).toContainText('Select token');
  });

  test('should handle partial query params (origin only)', async ({ page }) => {
    // 1. Navigate with partial query params (origin only)
    await page.goto(
      'http://localhost:3000?origin=base&originToken=0x0000000000000000000000000000000000000000',
    );

    // 2. Wait for 'Send' text visible
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // 3. Verify origin chain.
    await expect(getOriginTokenButton(page)).toHaveAttribute('data-chain', 'base');

    // 4. Verify destination is visible: page.getByTestId('token-select-destination')
    await expect(page.getByTestId('token-select-destination')).toBeVisible();
  });
});
