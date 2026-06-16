import { test, expect } from '@playwright/test';
import { waitForUnifiedForm } from '../helpers/locators';

test.describe('Unified Form - Enter Amount', () => {
  test('should enter transfer amount', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await waitForUnifiedForm(page);

    const amountInput = page.getByRole('spinbutton');
    await amountInput.click();
    await expect(amountInput).toBeFocused();

    await amountInput.fill('100');
    await expect(amountInput).toHaveValue('100');
  });
});
