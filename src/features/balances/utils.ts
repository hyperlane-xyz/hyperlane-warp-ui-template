import { Token } from '@hyperlane-xyz/sdk';
import { fromWeiRounded } from '@hyperlane-xyz/utils';
import { tokenKey } from './tokens';

export function formatBalance(balance: bigint, decimals: number): string {
  return fromWeiRounded(balance.toString(), decimals, 4);
}

export function formatUsd(value: number): string {
  if (value < 0.01) return '<$0.01';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function getUsdValue(
  token: Token,
  balances: Record<string, bigint>,
  prices: Record<string, number>,
): number | null {
  const key = tokenKey(token);
  const bal = balances[key];
  if (bal == null || !token.coinGeckoId) return null;
  const price = prices[token.coinGeckoId];
  if (price == null) return null;
  return (Number(bal) / 10 ** token.decimals) * price;
}
