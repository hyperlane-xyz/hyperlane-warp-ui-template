import { test, expect } from '@playwright/test';
import { config } from '../../src/consts/config';
import { resolveChainDisplayName } from '../helpers/constants';
import { getOriginTokenButton, getDestinationTokenButton } from '../helpers/locators';

test.describe('Page Load - Default Tokens', () => {
  test('should show config default origin and destination tokens if defined', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

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
});
