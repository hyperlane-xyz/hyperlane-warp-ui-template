// spec: specs/plan.md
// seed: tests/page-load/transfer-form-visible.spec.ts

import { test, expect } from '@playwright/test';
import { config } from '../../src/consts/config';
import { resolveChainDisplayName } from '../helpers/constants';
import { getOriginTokenButton, getDestinationTokenButton } from '../helpers/locators';

test.describe('Page Load - Query Param Token Override', () => {
  test('should use query params to set origin and destination tokens', async ({ page }) => {
    // 1. Navigate to app with query params to override origin and destination tokens to ETH
    await page.goto(
      'http://localhost:3000?origin=base&originToken=ETH&destination=ethereum&destinationToken=ETH',
    );

    // 2. Wait for 'Send' text visible
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // 3. Verify origin: page.getByRole('button', { name: 'base ETH Base' })
    await expect(page.getByRole('button', { name: 'base ETH Base' })).toBeVisible();

    // 4. Verify destination: page.getByRole('button', { name: 'ethereum ETH Ethereum' })
    await expect(page.getByRole('button', { name: 'ethereum ETH Ethereum' })).toBeVisible();

    // 5. Verify page.url() includes 'origin=base'
    await expect(page).toHaveURL(/origin=base/);
  });

  test('should fall back to config defaults with invalid query params', async ({ page }) => {
    await page.goto(
      'http://localhost:3000?origin=nonexistent&originToken=FAKE&destination=nonexistent&destinationToken=FAKE',
    );
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Should fall back to config defaults
    const originButton = getOriginTokenButton(page);
    await expect(originButton).toBeVisible();
    if (config.defaultOriginToken) {
      const [originChain, originSymbol] = config.defaultOriginToken.split('-');
      const originChainDisplay = await resolveChainDisplayName(originChain);
      await expect(originButton).toContainText(originSymbol);
      await expect(originButton).toContainText(originChainDisplay);
    }

    const destButton = getDestinationTokenButton(page);
    await expect(destButton).toBeVisible();
    if (config.defaultDestinationToken) {
      const [destChain, destSymbol] = config.defaultDestinationToken.split('-');
      const destChainDisplay = await resolveChainDisplayName(destChain);
      await expect(destButton).toContainText(destSymbol);
      await expect(destButton).toContainText(destChainDisplay);
    }
  });

  test('should handle partial query params (origin only)', async ({ page }) => {
    // 1. Navigate with partial query params (origin only)
    await page.goto('http://localhost:3000?origin=base&originToken=ETH');

    // 2. Wait for 'Send' text visible
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // 3. Verify origin: page.getByRole('button', { name: 'base ETH Base' })
    await expect(page.getByRole('button', { name: 'base ETH Base' })).toBeVisible();

    // 4. Verify destination is visible: page.getByTestId('token-select-destination')
    await expect(page.getByTestId('token-select-destination')).toBeVisible();
  });
});
