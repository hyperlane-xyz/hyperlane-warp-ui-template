import { expect, test } from '@playwright/test';
import { selectDestinationToken, selectOriginToken } from '../helpers/formFlow';
import { openE2EApp, waitForWarpRuntime } from '../helpers/page-setup';

// Registry-defined warp route endpoints for solanamainnet USDC. Hard-coded
// so a drift in upstream addresses fails the test loudly rather than
// silently passing on dedup'd collateral-group noise. The handoff's prior
// attempt at a UI-only assertion was fooled by `checkTokenHasRoute`'s
// collateralGroup dedup; asserting against Token.connections (which is not
// dedup'd) is the actual ground truth.
const SOLANAMAINNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const EXPECTED_ROUTE_ENDPOINTS: Array<{ chain: string; addressOrDenom: string }> = [
  // Eclipse synthetic mint, owned by the Solana warp router on 3EpVCPU...
  { chain: 'eclipsemainnet', addressOrDenom: 'EqRSt9aUDMKYKhzd1DGMderr3KNp29VZH3x5P7LFTC8m' },
  // Base HypSynthetic router for the solanamainnet ↔ base USDC warp route
  // on EiUymjh... (a different Solana router than the Eclipse one).
  { chain: 'base', addressOrDenom: '0xb46930ca998587a95d9ee000fa73a071add56b64' },
];

test.describe('Solana destination router identity', () => {
  test('solanamainnet USDC Token.connections resolve to the expected chain-scoped routers', async ({
    page,
  }) => {
    await openE2EApp(page);
    await waitForWarpRuntime(page);

    const info = await page.evaluate(() => {
      const tokens = window.__WARP_E2E__?.tokens ?? [];
      const byKey = new Map(tokens.map((t) => [t.key, t]));
      const solanaUsdc = tokens.filter((t) => t.chain === 'solanamainnet' && t.symbol === 'USDC');
      // For each solanamainnet USDC entry, resolve its connection keys to
      // {chain, addressOrDenom} tuples. Flatten across all solanamainnet
      // USDC routers so the test can assert on route endpoints without
      // depending on which specific origin router the picker landed on.
      const endpoints = solanaUsdc.flatMap((t) =>
        t.connectionKeys
          .map((k) => byKey.get(k))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map((c) => ({ chain: c.chain, addressOrDenom: c.addressOrDenom })),
      );
      const collaterals = new Set(solanaUsdc.map((t) => t.collateralAddressOrDenom));
      return {
        solanaUsdcCount: solanaUsdc.length,
        collaterals: [...collaterals],
        endpoints,
      };
    });
    const normalizedEndpoints = info.endpoints.map((endpoint) => ({
      ...endpoint,
      addressOrDenom:
        endpoint.chain === 'base' ? endpoint.addressOrDenom.toLowerCase() : endpoint.addressOrDenom,
    }));

    // All solanamainnet USDC warp-route tokens must pin the same underlying
    // SPL mint (the canonical USDC). If this drifts, an unrelated token
    // snuck in and the rest of the assertion is meaningless.
    expect(info.collaterals).toEqual([SOLANAMAINNET_USDC_MINT]);

    for (const expected of EXPECTED_ROUTE_ENDPOINTS) {
      expect(normalizedEndpoints, `expected endpoint for ${expected.chain}`).toContainEqual(
        expected,
      );
    }
  });

  test('picking solanamainnet USDC → eclipsemainnet USDC leaves both chain labels pinned', async ({
    page,
  }) => {
    await openE2EApp(page);
    await waitForWarpRuntime(page);

    await selectOriginToken(page, /solanamainnet USDC/i);
    await selectDestinationToken(page, /eclipsemainnet USDC/i);

    await expect(page.getByTestId('token-select-origin')).toContainText(/Solana/i);
    await expect(page.getByTestId('token-select-destination')).toContainText(/Eclipse/i);
    // Negative checks: the labels must be chain-scoped, not a dedup'd
    // fallback to some other USDC.
    await expect(page.getByTestId('token-select-origin')).not.toContainText(/Eclipse/i);
    await expect(page.getByTestId('token-select-destination')).not.toContainText(/^Solana/i);
  });
});
