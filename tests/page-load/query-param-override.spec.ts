// spec: specs/plan.md
// seed: tests/page-load/unified-form.spec.ts

import { test, expect } from '@playwright/test';
import { config } from '../../src/consts/config';
import {
  getOriginTokenButton,
  getDestinationTokenButton,
  waitForUnifiedForm,
} from '../helpers/locators';

function parseConfigTokenRef(value: string): { chainName: string; tokenRef: string } {
  const separator = value.indexOf('-');
  return {
    chainName: value.slice(0, separator),
    tokenRef: value.slice(separator + 1),
  };
}

function isSymbolRef(value: string): boolean {
  return /^[A-Z0-9]{2,12}$/.test(value);
}

test.describe('Page Load - Query Param Token Override', () => {
  test('should use query params to set origin and destination tokens', async ({ page }) => {
    // 1. Navigate to app with query params to override origin and destination tokens to ETH
    await page.goto(
      'http://localhost:3000?origin=base&originToken=0x0000000000000000000000000000000000000000&destination=ethereum&destinationToken=0x0000000000000000000000000000000000000000',
    );

    await waitForUnifiedForm(page);

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
    await waitForUnifiedForm(page);

    // Should fall back to config defaults
    const originButton = getOriginTokenButton(page);
    await expect(originButton).toBeVisible();
    if (config.defaultOriginToken) {
      const origin = parseConfigTokenRef(config.defaultOriginToken);
      await expect(originButton).toHaveAttribute('data-chain', origin.chainName);
      if (isSymbolRef(origin.tokenRef)) await expect(originButton).toContainText(origin.tokenRef);
    }

    const destButton = getDestinationTokenButton(page);
    await expect(destButton).toBeVisible();
    if (config.defaultDestinationToken) {
      const destination = parseConfigTokenRef(config.defaultDestinationToken);
      await expect(destButton).toHaveAttribute('data-chain', destination.chainName);
      if (isSymbolRef(destination.tokenRef))
        await expect(destButton).toContainText(destination.tokenRef);
    }
  });

  test('should handle partial query params (origin only)', async ({ page }) => {
    // 1. Navigate with partial query params (origin only)
    await page.goto(
      'http://localhost:3000?origin=base&originToken=0x0000000000000000000000000000000000000000',
    );

    await waitForUnifiedForm(page);

    // 3. Verify origin token button picked the query-param token.
    const originButton = getOriginTokenButton(page);
    await expect(originButton).toHaveAttribute('data-chain', 'base');
    await expect(originButton).toContainText('ETH');

    // 4. Verify destination is visible: page.getByTestId('token-select-destination')
    await expect(page.getByTestId('token-select-destination')).toBeVisible();
  });
});
