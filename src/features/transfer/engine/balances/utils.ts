import { fromWei, fromWeiRounded } from '@hyperlane-xyz/utils';

import type { UiToken } from '../tokens/types';
import { getTokenKey, tokenKey } from '../tokens/utils';
import type { FeeComponent } from '../types';

export { formatBalance, formatDisplayAmount, formatUsd } from '../../../../utils/amount';

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
  const t = tokenMap.get(tokenKey(component.chainId, component.tokenAddress));
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

export function getFeePercentage(totalFeesUsd: number, transferUsd: number): string | null {
  if (totalFeesUsd <= 0 || transferUsd <= 0) return null;
  const pct = (totalFeesUsd / transferUsd) * 100;
  if (pct < 0.01) return '<0.01%';
  if (pct >= 100) return '>=100%';
  return `${pct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
