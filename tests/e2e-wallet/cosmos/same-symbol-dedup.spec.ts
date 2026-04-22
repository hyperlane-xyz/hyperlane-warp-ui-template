import { expect, test } from '@playwright/test';
import { openE2EApp } from '../helpers/page-setup';

async function openOriginAndSearch(page: import('@playwright/test').Page, query: string) {
  await page.getByTestId('token-select-origin').click();
  await page.getByText('Select Token').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByLabel('Search tokens').fill(query);
}

test.describe('Cosmos same-symbol dedup', () => {
  test('celestia TIA vs stride TIA resolve to distinct destination routes', async ({ page }) => {
    await openE2EApp(page);

    // Origin = TIA on celestia. The published registry exposes
    // TIA/celestia-{ethereum,eclipsemainnet,solanamainnet,abstract,base}, so
    // the auto-resolved destination lives on one of those EVM/SVM chains.
    await openOriginAndSearch(page, 'celestia');
    await page
      .getByRole('button', { name: /celestia TIA/i })
      .first()
      .click({ timeout: 30_000 });
    await page.getByText('Select Token').waitFor({ state: 'hidden', timeout: 30_000 });

    const origin = page.getByTestId('token-select-origin');
    const destination = page.getByTestId('token-select-destination');
    await expect(origin).toContainText(/Celestia/i);
    // Destination must not be a cosmos chain — celestia's connections are all
    // EVM/Sealevel/Abstract. In particular it must not be stride (Stride TIA
    // would be a different warp route entirely).
    await expect(destination).not.toContainText(/Stride/i);
    await expect(destination).not.toContainText(/Celestia/i);
    const celestiaDestText = await destination.innerText();

    // Origin = TIA on stride. stride-originated TIA routes connect to
    // eclipsemainnet/forma/celestia — a disjoint destination set from the
    // celestia-originated side.
    await openOriginAndSearch(page, 'stride');
    await page
      .getByRole('button', { name: /stride TIA/i })
      .first()
      .click({ timeout: 30_000 });
    await page.getByText('Select Token').waitFor({ state: 'hidden', timeout: 30_000 });

    await expect(origin).toContainText(/Stride/i);
    await expect(origin).not.toContainText(/Celestia/i);
    const strideDestText = await destination.innerText();

    // Same-symbol correctness: the destination flipped because the underlying
    // warp route differs — NOT because the chain label happened to re-render.
    // If dedup were broken and stride TIA fell back to the celestia route,
    // both invocations would leave the destination button identical.
    expect(strideDestText).not.toBe(celestiaDestText);
  });
});
