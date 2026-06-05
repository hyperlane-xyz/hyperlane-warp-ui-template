import { fromWei, fromWeiRounded } from '@hyperlane-xyz/utils';

import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';
import type { FeeComponent } from '../types';

export { formatBalance, formatUsd } from '../../../utils/amount';

// Fee amounts need more precision than balances — gas fees can be ~1e-5
// native units which formatBalance's 4-decimal rounding renders as "0.0000".
export function formatFeeAmount(amount: bigint, decimals: number): string {
  return fromWeiRounded(amount.toString(), decimals, 8);
}

export function getUsdValue(
  token: UiToken,
  balances: Record<string, bigint>,
  prices: Record<string, number>,
): number | null {
  const key = getTokenKey(token);
  const bal = balances[key];
  if (bal == null || !token.coinGeckoId) return null;
  const price = prices[token.coinGeckoId];
  if (price == null) return null;
  return parseFloat(fromWei(bal.toString(), token.decimals)) * price;
}

export function resolveCoinGeckoId(
  component: FeeComponent,
  tokenMap: Map<string, UiToken>,
): { coinGeckoId: string | undefined; decimals: number } {
  const t = tokenMap.get(`${component.chainId}-${component.tokenAddress.toLowerCase()}`);
  return { coinGeckoId: t?.coinGeckoId, decimals: t?.decimals ?? 18 };
}

// Returns null if any component is unpriced — a partial sum would
// understate the total and mislead the % readout.
export function getTotalFeeUsd(
  components: FeeComponent[],
  tokenMap: Map<string, UiToken>,
  prices: Record<string, number>,
): number | null {
  let total = 0;
  for (const c of components) {
    const { coinGeckoId, decimals } = resolveCoinGeckoId(c, tokenMap);
    if (!coinGeckoId) return null;
    const price = prices[coinGeckoId];
    if (price == null) return null;
    total += parseFloat(fromWei(c.amount.toString(), decimals)) * price;
  }
  return total;
}
