import { test, expect } from '@playwright/test';
import { getOriginTokenButton, getDestinationTokenButton } from '../helpers/locators';

test.describe('Transfer Form - Swap Tokens', () => {
  test('should swap origin and destination tokens', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Record the initial origin and destination token labels before swap
    const originBtn = getOriginTokenButton(page);
    const destBtn = getDestinationTokenButton(page);

    const initialOriginName = await originBtn.textContent();
    const initialDestName = await destBtn.textContent();

    // Ensure both buttons are visible
    await expect(originBtn).toBeVisible();
    await expect(destBtn).toBeVisible();

    // Click swap button (between Send and Receive sections)
    await page.locator('div.-my-3 > button').click();

    // After swap: origin and destination should have exchanged their tokens
    await expect(originBtn).toHaveText(initialDestName!);
    await expect(destBtn).toHaveText(initialOriginName!);
  });
});
