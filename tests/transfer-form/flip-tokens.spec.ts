import { test, expect } from '@playwright/test';
import { getOriginTokenButton, getDestinationTokenButton } from '../helpers/locators';

test.describe('Transfer Form - Flip Tokens', () => {
  test('should flip origin and destination tokens', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Record the initial origin and destination token labels before flip.
    const originBtn = getOriginTokenButton(page);
    const destBtn = getDestinationTokenButton(page);

    await expect(originBtn).not.toHaveText(/Select token/i);
    await expect(destBtn).not.toHaveText(/Select token/i);

    const initialOriginName = await originBtn.textContent();
    const initialDestName = await destBtn.textContent();

    // Ensure both buttons are visible
    await expect(originBtn).toBeVisible();
    await expect(destBtn).toBeVisible();

    // Click flip button (between Send and Receive sections).
    await page.locator('div.-my-3 > button').click();

    // After flip: origin and destination should have exchanged their tokens.
    await expect(originBtn).toHaveText(initialDestName!);
    await expect(destBtn).toHaveText(initialOriginName!);
  });
});
