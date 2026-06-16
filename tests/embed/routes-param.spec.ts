import { test, expect } from '@playwright/test';
import { resolveTestRoutes } from '../helpers/constants';
import { waitForUnifiedForm } from '../helpers/locators';

const { primary, secondary, skip } = resolveTestRoutes();

test.describe('Routes Parameter', () => {
  test('should load embed page with a valid routes param', async ({ page }) => {
    test.skip(skip, 'warpRouteWhitelist is empty — no valid routes to test');

    await page.goto(`http://localhost:3000/embed?routes=${primary}`);
    await waitForUnifiedForm(page);
  });

  test('should load embed page with empty routes param gracefully', async ({ page }) => {
    await page.goto('http://localhost:3000/embed?routes=');
    await waitForUnifiedForm(page);
  });

  test('should load embed page with multiple routes param', async ({ page }) => {
    test.skip(skip, 'warpRouteWhitelist is empty — no valid routes to test');

    await page.goto(`http://localhost:3000/embed?routes=${primary},${secondary}`);
    await waitForUnifiedForm(page);
  });

  test('should fail to load with fake/nonexistent route', async ({ page }) => {
    await page.goto('http://localhost:3000/embed?routes=FAKE/nonexistent-route');
    // Nonexistent routes cause the app to error — token selectors should never become visible
    await expect(page.getByTestId('token-select-origin')).toBeHidden({ timeout: 10000 });
  });

  test('should handle mix of real and fake routes', async ({ page }) => {
    test.skip(skip, 'warpRouteWhitelist is empty — no valid routes to test');

    await page.goto(`http://localhost:3000/embed?routes=${primary},FAKE/does-not-exist`);
    await waitForUnifiedForm(page);
  });
});
