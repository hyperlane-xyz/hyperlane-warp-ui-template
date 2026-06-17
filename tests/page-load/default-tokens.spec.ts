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

test.describe('Page Load - Default Tokens', () => {
  test('should show config default origin and destination tokens if defined', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await waitForUnifiedForm(page);

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
});
