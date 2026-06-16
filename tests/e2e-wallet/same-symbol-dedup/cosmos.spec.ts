import { expect, test } from '@playwright/test';
import { searchAndSelectOriginToken } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

test.describe('Cosmos same-symbol dedup', () => {
  test('celestia TIA vs stride TIA resolve to distinct origin tokens', async ({ page }) => {
    await openE2EApp(page);

    await searchAndSelectOriginToken(page, 'celestia', /celestia TIA/i);

    const origin = page.getByTestId('token-select-origin');
    const destination = page.getByTestId('token-select-destination');
    await expect(origin).toContainText(/Celestia/i);
    await expect(destination).toContainText(/Select token/i);
    const celestiaDestText = await destination.innerText();

    await searchAndSelectOriginToken(page, 'stride', /stride TIA/i);

    await expect(origin).toContainText(/Stride/i);
    await expect(origin).not.toContainText(/Celestia/i);
    const strideDestText = await destination.innerText();

    // The unified form no longer auto-picks the first destination after a new
    // origin selection; same-symbol correctness here is that the origin label
    // flips to the selected Cosmos route without falling back to Celestia.
    expect(strideDestText).toBe(celestiaDestText);
  });
});
