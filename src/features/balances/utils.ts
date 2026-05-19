import { Token } from '@hyperlane-xyz/sdk';

import { getTokenKey } from '../tokens/utils';

export { formatBalance, formatUsd } from '../../utils/amount';

export function getUsdValue(
  token: Token,
  balances: Record<string, bigint>,
  prices: Record<string, number>,
): number | null {
  const key = getTokenKey(token);
  const bal = balances[key];
  if (bal == null || !token.coinGeckoId) return null;
  const price = prices[token.coinGeckoId];
  if (price == null) return null;
  return (Number(bal) / 10 ** token.decimals) * price;
}
