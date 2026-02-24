import { TokenAmount } from '@hyperlane-xyz/sdk';
import type { FeePrices } from './useFeePrices';
import { formatUsd } from './utils';

export function getUsdDisplayForFee(
  tokenAmount: TokenAmount | undefined,
  feePrices: FeePrices,
): string | null {
  if (!tokenAmount || tokenAmount.amount === 0n) return null;
  const price = feePrices[tokenAmount.token.symbol];
  if (!price) return null;
  const value = tokenAmount.getDecimalFormattedAmount() * price;
  if (value <= 0) return null;
  return formatUsd(value, true);
}

export function getTotalFeesUsdRaw(
  fees: { localQuote: TokenAmount; interchainQuote: TokenAmount; tokenFeeQuote?: TokenAmount },
  feePrices: FeePrices,
): number {
  let total = 0;
  for (const quote of [fees.localQuote, fees.interchainQuote, fees.tokenFeeQuote]) {
    if (!quote || quote.amount === 0n) continue;
    const price = feePrices[quote.token.symbol];
    if (!price) continue;
    total += quote.getDecimalFormattedAmount() * price;
  }
  return total;
}

export function getTotalFeesUsd(
  fees: { localQuote: TokenAmount; interchainQuote: TokenAmount; tokenFeeQuote?: TokenAmount },
  feePrices: FeePrices,
): string | null {
  const total = getTotalFeesUsdRaw(fees, feePrices);
  if (total <= 0) return null;
  return formatUsd(total, true);
}

export function getFeePercentage(totalFeesUsd: number, transferUsd: number): string | null {
  if (totalFeesUsd <= 0 || transferUsd <= 0) return null;
  const pct = (totalFeesUsd / transferUsd) * 100;
  if (pct < 0.01) return '<0.01%';
  if (pct >= 100) return '≥100%';
  return `${pct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
