import { test, expect } from '@playwright/test';
import { config } from '../../src/consts/config';
import { getOriginTokenButton, getDestinationTokenButton } from '../helpers/locators';
import { splitTokenId } from '../helpers/constants';

test.describe('Page Load - Default Tokens', () => {
  test('should show config default origin and destination tokens if defined', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    const originButton = getOriginTokenButton(page);
    await expect(originButton).toBeVisible();
    const origin = splitTokenId(config.defaultSwapOriginToken);
    if (origin) {
      await expect(originButton).toHaveAttribute('data-chain', origin.chainName);
    }

    const destButton = getDestinationTokenButton(page);
    await expect(destButton).toBeVisible();
    const destination = splitTokenId(config.defaultSwapDestinationToken);
    if (destination) {
      await expect(destButton).toHaveAttribute('data-chain', destination.chainName);
    }
  });
});
