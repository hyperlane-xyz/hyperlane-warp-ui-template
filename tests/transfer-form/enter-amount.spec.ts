import { test, expect } from '@playwright/test';
import { waitForTransferForm } from '../helpers/locators';

test.describe('Transfer Form - Enter Amount', () => {
  test('should enter transfer amount', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await waitForTransferForm(page);

    // Click and type in amount input
    const amountInput = page.getByRole('spinbutton');
    await amountInput.click();
    await expect(amountInput).toBeFocused();

    await amountInput.fill('100');
    await expect(amountInput).toHaveValue('100');
  });
});
