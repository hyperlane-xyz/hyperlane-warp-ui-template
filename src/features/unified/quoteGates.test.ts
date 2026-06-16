import { describe, expect, test } from 'vitest';

import { shouldFetchUnifiedBridgeFeeQuote, shouldFetchUnifiedSwapQuote } from './quoteGates';
import { UnifiedRouteMode } from './tokens/routes';

describe('unified quote gates', () => {
  test('does not fetch swap quotes for bridge routes', () => {
    expect(shouldFetchUnifiedSwapQuote(UnifiedRouteMode.Bridge)).toBe(false);
  });

  test('fetches swap quotes only for swap routes', () => {
    expect(shouldFetchUnifiedSwapQuote(UnifiedRouteMode.Swap)).toBe(true);
    expect(shouldFetchUnifiedSwapQuote(null)).toBe(false);
  });

  test('fetches bridge fee quotes only for current bridge quotes', () => {
    expect(
      shouldFetchUnifiedBridgeFeeQuote({
        routeMode: UnifiedRouteMode.Bridge,
        isBridgeQuoteCurrent: true,
      }),
    ).toBe(true);
    expect(
      shouldFetchUnifiedBridgeFeeQuote({
        routeMode: UnifiedRouteMode.Bridge,
        isBridgeQuoteCurrent: false,
      }),
    ).toBe(false);
    expect(
      shouldFetchUnifiedBridgeFeeQuote({
        routeMode: UnifiedRouteMode.Swap,
        isBridgeQuoteCurrent: true,
      }),
    ).toBe(false);
  });
});
