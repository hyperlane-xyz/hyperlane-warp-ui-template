import { test, expect } from '@playwright/test';
import { config } from '../../src/consts/config';
import { getTipCard } from '../helpers/locators';

test.describe('Page Load - Tip Card', () => {
  test('should display tip card', async ({ page }) => {
    test.skip(!config.showTipBox, 'Tip card disabled in config');

    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Tip card container visible — content/copy varies per branch, so assert structure only
    const tipCard = getTipCard(page);
    await expect(tipCard).toBeVisible();

    // Close tip card
    await page.getByRole('button', { name: 'Hide tip' }).click();

    // Tip card should disappear
    await expect(tipCard).not.toBeVisible();
  });
});
