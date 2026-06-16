import { test, expect } from '@playwright/test';
import {
  getOriginTokenButton,
  getDestinationTokenButton,
  waitForTransferForm,
} from '../helpers/locators';

test.describe('Unified Form - Swap Tokens', () => {
  test('should swap origin and destination tokens', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await waitForTransferForm(page);

    const originBtn = getOriginTokenButton(page);
    const destBtn = getDestinationTokenButton(page);

    const initialOriginName = await originBtn.textContent();
    const initialDestName = await destBtn.textContent();

    await expect(originBtn).toBeVisible();
    await expect(destBtn).toBeVisible();

    await page.getByRole('button', { name: 'Swap origin and destination tokens' }).click();

    await expect(originBtn).toHaveText(initialDestName!);
    await expect(destBtn).toHaveText(initialOriginName!);
  });
});
