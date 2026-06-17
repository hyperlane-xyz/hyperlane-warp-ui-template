import { test, expect } from '@playwright/test';
import { resolveTestTokenParams } from '../helpers/constants';

const { origin, originToken, destination, destinationToken, skip } = resolveTestTokenParams();

test.describe('Embed Token Parameters', () => {
  test('should load embed page with valid token params', async ({ page }) => {
    test.skip(skip, 'defaultSwapOriginToken/defaultSwapDestinationToken are not configured');

    await page.goto(
      `http://localhost:3000/embed?origin=${origin}&originToken=${originToken}&destination=${destination}&destinationToken=${destinationToken}`,
    );
    await page.getByText('Send').first().waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.getByText('Send').first()).toBeVisible();
  });

  test('should load embed page with empty token params gracefully', async ({ page }) => {
    await page.goto('http://localhost:3000/embed?origin=&originToken=&destination=&destinationToken=');
    await page.getByText('Send').first().waitFor({ state: 'visible' });
    await expect(page.getByText('Send').first()).toBeVisible();
  });

  test('should ignore fake token params without crashing', async ({ page }) => {
    await page.goto(
      'http://localhost:3000/embed?origin=FAKE&originToken=does-not-exist&destination=FAKE&destinationToken=does-not-exist',
    );
    await page.getByText('Send').first().waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.getByText('Send').first()).toBeVisible();
  });
});
