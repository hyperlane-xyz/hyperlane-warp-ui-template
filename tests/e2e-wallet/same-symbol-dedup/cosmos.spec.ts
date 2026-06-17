import { expect, test } from '@playwright/test';
import {
  searchAndSelectDestinationToken,
  searchAndSelectOriginToken,
} from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

test.describe('Cosmos same-symbol dedup', () => {
  test('celestia TIA vs stride TIA resolve to distinct bridge routes', async ({ page }) => {
    await openE2EApp(page);

    await searchAndSelectOriginToken(page, 'celestia', /celestia TIA/i);
    await searchAndSelectDestinationToken(page, 'base', /base TIA/i);

    const origin = page.getByTestId('token-select-origin');
    const destination = page.getByTestId('token-select-destination');
    await expect(origin).toContainText(/Celestia/i);
    await expect(destination).toContainText(/Base/i);
    await expect(page.getByText('Route: bridge')).toBeVisible();
    const celestiaDestText = await destination.innerText();

    await searchAndSelectOriginToken(page, 'stride', /stride TIA/i);
    await searchAndSelectDestinationToken(page, 'forma', /forma TIA/i);

    await expect(origin).toContainText(/Stride/i);
    await expect(origin).not.toContainText(/Celestia/i);
    await expect(destination).toContainText(/Forma/i);
    await expect(page.getByText('Route: bridge')).toBeVisible();
    const strideDestText = await destination.innerText();

    expect(strideDestText).not.toBe(celestiaDestText);
  });
});
