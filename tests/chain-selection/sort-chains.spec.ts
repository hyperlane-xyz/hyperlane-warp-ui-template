import { test, expect } from '@playwright/test';
import { getOriginTokenButton } from '../helpers/locators';

async function visibleChainNames(page: import('@playwright/test').Page): Promise<string[]> {
  return page.locator('.token-picker-chain-row[data-chain]').evaluateAll((rows) =>
    rows
      .map((row) => row.getAttribute('data-chain'))
      .filter((name): name is string => Boolean(name)),
  );
}

function findSortedTailStart(names: string[], direction: 'asc' | 'desc'): number {
  const compare =
    direction === 'asc'
      ? (a: string, b: string) => a.localeCompare(b)
      : (a: string, b: string) => b.localeCompare(a);

  for (let i = 0; i < names.length; i++) {
    const tail = names.slice(i);
    if (tail.every((name, index) => index === 0 || compare(tail[index - 1], name) <= 0)) {
      return i;
    }
  }
  return names.length;
}

function expectSortedAfterPriorityPrefix(names: string[], direction: 'asc' | 'desc') {
  const tailStart = findSortedTailStart(names, direction);
  const sortedTail = names.slice(tailStart);
  const sorted = [...sortedTail].sort((a, b) =>
    direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a),
  );

  expect(sortedTail.length).toBeGreaterThan(names.length / 2);
  expect(sortedTail).toEqual(sorted);
}

test.describe('Chain Selection - Sort Chains', () => {
  test('should open sort dropdown and show sort options', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();
    await expect(page.getByText('Select Token')).toBeVisible();

    // Open sort dropdown
    await page.getByRole('button', { name: 'Sort: Featured (asc)' }).click();

    // Should show sort options
    await expect(page.getByText('Sort by')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Featured', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Name', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chain Id', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Protocol', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle sort order' })).toBeVisible();
  });

  test('should sort chains by Chain Id', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();

    // Switch to Chain Id sort
    await page.getByRole('button', { name: 'Sort: Featured (asc)' }).click();
    await page.getByRole('button', { name: 'Chain Id', exact: true }).click();

    const names = await visibleChainNames(page);
    expect(names.indexOf('ethereum')).toBeLessThan(names.indexOf('optimism'));
    expect(names.indexOf('optimism')).toBeLessThan(names.indexOf('bsc'));
    expect(names.indexOf('bsc')).toBeLessThan(names.indexOf('base'));
  });

  test('should toggle sort order', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    await getOriginTokenButton(page).click();

    // Switch from default Featured sort to Name asc.
    await page.getByRole('button', { name: 'Sort: Featured (asc)' }).click();
    await page.getByRole('button', { name: 'Name', exact: true }).click();

    const ascNames = await visibleChainNames(page);
    expectSortedAfterPriorityPrefix(ascNames, 'asc');

    // Open sort and toggle order to desc
    await page.getByRole('button', { name: 'Sort: Name (asc)' }).click();
    await page.getByRole('button', { name: 'Toggle sort order' }).click();

    const descNames = await visibleChainNames(page);
    expectSortedAfterPriorityPrefix(descNames, 'desc');
  });
});
