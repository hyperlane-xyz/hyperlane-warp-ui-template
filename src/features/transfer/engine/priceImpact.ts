import { isNullish } from '@hyperlane-xyz/utils';

export const MAX_PRICE_IMPACT_PCT = 10;
export const PRICE_IMPACT_BLOCK_MESSAGE = `Price impact is ${MAX_PRICE_IMPACT_PCT}% or higher`;

export function isPriceImpactTooHigh(priceImpactPct: number | null): boolean {
  return !isNullish(priceImpactPct) && priceImpactPct <= -MAX_PRICE_IMPACT_PCT;
}
