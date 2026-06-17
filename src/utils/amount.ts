import { fromWeiRounded } from '@hyperlane-xyz/utils';

const MAX_TOKEN_DECIMALS = 255;

// Shared amount/USD formatters — identical across bridge and swap.
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

export function formatInputAmount(atomicAmount: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_TOKEN_DECIMALS) {
    throw new Error(`Invalid token decimals: ${decimals}`);
  }
  if (decimals === 0) return atomicAmount.toString();

  const divisor = 10n ** BigInt(decimals);
  const integerPart = atomicAmount / divisor;
  const fractionalPart = atomicAmount % divisor;
  if (fractionalPart === 0n) return integerPart.toString();

  const fraction = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${integerPart}.${fraction}`;
}

export function formatUsd(value: number, approximate = false): string {
  if (!Number.isFinite(value) || value < 0) return '-';
  if (value < 0.01) return '<$0.01';
  const prefix = approximate ? '≈$' : '$';
  return `${prefix}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
