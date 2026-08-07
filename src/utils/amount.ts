import { fromWeiRounded } from '@hyperlane-xyz/utils';

// Shared amount/USD formatters.
// Feature-specific `getUsdValue` lives in each feature's balances/utils.ts
// because price-lookup keys differ (CoinGecko id vs lowercase symbol).
export function formatBalance(balance: bigint, decimals: number): string {
  return fromWeiRounded(balance.toString(), decimals, 4);
}

export function formatDisplayAmount(atomicAmount: bigint, decimals: number): string {
  const formatted = fromWeiRounded(atomicAmount.toString(), decimals, decimals);
  const [integerPart, fractionalPart = ''] = formatted.split('.');
  if (!fractionalPart) return integerPart;

  const firstNonZeroIndex = fractionalPart.search(/[1-9]/);
  if (firstNonZeroIndex === -1) return integerPart;

  const decimalPlaces = integerPart === '0' && firstNonZeroIndex >= 4 ? firstNonZeroIndex + 4 : 4;
  const visibleFraction = fractionalPart.slice(0, decimalPlaces).replace(/0+$/, '');
  return visibleFraction ? `${integerPart}.${visibleFraction}` : integerPart;
}

export function formatUsd(value: number, approximate = false): string {
  if (value < 0.01) return '<$0.01';
  const prefix = approximate ? '≈$' : '$';
  return `${prefix}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
