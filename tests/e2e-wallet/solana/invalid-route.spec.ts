import { expect, test } from '@playwright/test';
import { getCapturedSolanaTxs } from '../helpers/captured';
import { selectOriginToken } from '../helpers/formFlow';
import { openE2EApp } from '../helpers/page-setup';

test.describe('Solana route gate', () => {
  test('selecting Solana USDC as origin against the default EVM destination gates submit', async ({
    page,
  }) => {
    await openE2EApp(page);

    // Default destination is base-USDC (EVM). Switching origin to solanamainnet
    // USDC creates a cross-protocol selection that the registry's default warp
    // routes do NOT support — the submit button must NOT read "Continue".
    await selectOriginToken(page, /solanamainnet USDC/i);

    // Allow the form validator to settle on a non-ready state — accept any of
    // the gated labels (Route error, Insufficient fund warnings, explicit
    // validation labels). What matters is that it is NOT "Continue".
    const submit = page.locator('form button[type="submit"], form button[type="button"]').first();
    await expect(submit).toBeVisible({ timeout: 15_000 });
    // Poll for the non-Continue steady state.
    await expect
      .poll(async () => (await submit.textContent())?.trim(), {
        timeout: 15_000,
        intervals: [500],
      })
      .not.toMatch(/^Continue$/);

    // And no Solana tx must have been emitted to the mock adapter.
    expect(await getCapturedSolanaTxs(page)).toHaveLength(0);
  });
});
