import { isNullish } from '@hyperlane-xyz/utils';
import { formatUnits } from 'viem';

import type { RouteResponse } from '../../api/types';

export const MAX_PRICE_IMPACT_PCT = 10;

// The price-impact guard only applies to swap (hyperswap) routes, where the
// output amount depends on market rates. Direct bridge routes are 1:1 and their
// fixed interchain fees are governed by the bridge fee-coverage rejection.
export function routeContainsSwap(
  route: { steps: ReadonlyArray<{ type: RouteResponse['steps'][number]['type'] }> } | undefined,
): boolean {
  return !!route?.steps.some((step) => step.type === 'swap');
}

export function isPriceImpactTooHigh(priceImpactPct: number | null): boolean {
  return !isNullish(priceImpactPct) && priceImpactPct <= -MAX_PRICE_IMPACT_PCT;
}

export function getPriceImpactBlockMessage(priceImpactPct: number | null): string {
  const lossPct = Math.abs(priceImpactPct ?? MAX_PRICE_IMPACT_PCT).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
  return `Swap price impact too high (${lossPct}%)`;
}

export function getRouteOutputAmounts(
  route: Pick<RouteResponse, 'output' | 'outputMin'> | undefined,
  decimals: number | undefined,
): [expected: string, minimum: string] {
  if (!route || isNullish(decimals)) return ['', ''];
  return [
    formatUnits(BigInt(route.output), decimals),
    formatUnits(BigInt(route.outputMin), decimals),
  ];
}
