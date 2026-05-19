import { fromWeiRounded } from '@hyperlane-xyz/utils';

import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';

export { formatBalance, formatUsd } from '../../../utils/amount';

// Fee amounts need more precision than balances — gas fees can be ~1e-5
// native units which formatBalance's 4-decimal rounding renders as "0.0000".
export function formatFeeAmount(amount: bigint, decimals: number): string {
  return fromWeiRounded(amount.toString(), decimals, 8);
}

// Swap-side getUsdValue keys USD prices by lowercase symbol because the
// engine doesn't yet expose coinGeckoId per token. Bridge's version keys
// by coinGeckoId — different lookup, kept separate.
export function getUsdValue(
  token: UiToken,
  balances: Record<string, bigint>,
  prices: Record<string, number>,
): number | null {
  const key = getTokenKey(token);
  const bal = balances[key];
  if (bal == null) return null;
  const symbolKey = token.symbol.toLowerCase();
  const price = prices[symbolKey];
  if (price == null) return null;
  return (Number(bal) / 10 ** token.decimals) * price;
}
