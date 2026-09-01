import { isNullish } from '@hyperlane-xyz/utils';
import { formatUnits } from 'viem';

import type { RouteResponse } from '../../api/types';

export const MAX_PRICE_IMPACT_PCT = 10;

export function isPriceImpactTooHigh(priceImpactPct: number | null): boolean {
  return !isNullish(priceImpactPct) && priceImpactPct <= -MAX_PRICE_IMPACT_PCT;
}

export function getPriceImpactBlockMessage(priceImpactPct: number | null): string {
  const lossPct = Math.abs(priceImpactPct ?? MAX_PRICE_IMPACT_PCT).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
  return `Minimum received is ${lossPct}% below input value`;
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
