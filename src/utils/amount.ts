import { fromWeiRounded } from '@hyperlane-xyz/utils';

// Shared amount/USD formatters — identical across bridge and swap.
// Feature-specific `getUsdValue` lives in each feature's balances/utils.ts
// because price-lookup keys differ (CoinGecko id vs lowercase symbol).
export function formatBalance(balance: bigint, decimals: number): string {
  return fromWeiRounded(balance.toString(), decimals, 4);
}

export function formatUsd(value: number, approximate = false): string {
  if (value < 0.01) return '<$0.01';
  const prefix = approximate ? '≈$' : '$';
  return `${prefix}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
