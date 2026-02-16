import { TokenAmount } from '@hyperlane-xyz/sdk';
import { FeePrices } from './useFeePrices';

function formatUsd(value: number): string | null {
  if (value < 0.01) return null;
  return `≈$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getUsdDisplayForFee(
  tokenAmount: TokenAmount | undefined,
  feePrices: FeePrices,
): string | null {
  if (!tokenAmount || tokenAmount.amount === 0n) return null;
  const id = tokenAmount.token.coinGeckoId;
  if (!id || !feePrices[id]) return null;
  const usd = tokenAmount.getDecimalFormattedAmount() * feePrices[id];
  return formatUsd(usd);
}

export function getTotalFeesUsd(
  fees: { localQuote: TokenAmount; interchainQuote: TokenAmount; tokenFeeQuote?: TokenAmount },
  feePrices: FeePrices,
): string | null {
  let total = 0;
  for (const quote of [fees.localQuote, fees.interchainQuote, fees.tokenFeeQuote]) {
    if (!quote || quote.amount === 0n) continue;
    const id = quote.token.coinGeckoId;
    if (!id || !feePrices[id]) continue;
    total += quote.getDecimalFormattedAmount() * feePrices[id];
  }
  return formatUsd(total);
}
