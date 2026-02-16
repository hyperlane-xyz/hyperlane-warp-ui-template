import { TokenAmount } from '@hyperlane-xyz/sdk';
import { FeePrices } from './useFeePrices';

function formatUsd(value: number): string | null {
  if (value <= 0) return null;
  if (value < 0.01) return '<$0.01';
  return `≈$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getUsdDisplayForFee(
  tokenAmount: TokenAmount | undefined,
  feePrices: FeePrices,
): string | null {
  if (!tokenAmount || tokenAmount.amount === 0n) return null;
  const price = feePrices[tokenAmount.token.symbol];
  if (!price) return null;
  return formatUsd(tokenAmount.getDecimalFormattedAmount() * price);
}

export function getTotalFeesUsd(
  fees: { localQuote: TokenAmount; interchainQuote: TokenAmount; tokenFeeQuote?: TokenAmount },
  feePrices: FeePrices,
): string | null {
  let total = 0;
  for (const quote of [fees.localQuote, fees.interchainQuote, fees.tokenFeeQuote]) {
    if (!quote || quote.amount === 0n) continue;
    const price = feePrices[quote.token.symbol];
    if (!price) continue;
    total += quote.getDecimalFormattedAmount() * price;
  }
  return formatUsd(total);
}
