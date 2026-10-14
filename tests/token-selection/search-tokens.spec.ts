import { test, expect } from '../fixtures';
import { getOriginTokenButton } from '../helpers/locators';

test.describe('Token Selection - Search Tokens', () => {
  test('should search tokens by name', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Open origin token selector
    await getOriginTokenButton(page).click();
    await expect(page.getByText('Select Token', { exact: true })).toBeVisible();

    const searchResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/v1/tokens' &&
        url.searchParams.get('search') === 'ETH' &&
        response.status() === 200
      );
    });

    // Type in token search and wait for the debounced API request.
    await page.getByPlaceholder('Search Name, Symbol, or Contract Address').fill('ETH');
    await searchResponse;

    // stETH comes from the search response, not the initial token list.
    await expect(page.locator('.token-picker-row').filter({ hasText: 'stETH' })).toBeVisible();
  });
});
