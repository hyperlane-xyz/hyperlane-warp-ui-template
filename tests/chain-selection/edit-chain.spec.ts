import { test, expect } from '@playwright/test';
import { getOriginTokenButton } from '../helpers/locators';

test.describe('Chain Selection - Edit Chain', () => {
  test('should exit edit mode', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();

    // Enter edit mode
    await page.getByRole('button', { name: 'Edit chain metadata' }).click();
    await expect(page.getByRole('button', { name: 'Exit edit mode' })).toBeVisible();

    // Exit edit mode
    await page.getByRole('button', { name: 'Exit edit mode' }).click();

    // Should show "Edit chain metadata" again
    await expect(page.getByRole('button', { name: 'Edit chain metadata' })).toBeVisible();
  });
});
