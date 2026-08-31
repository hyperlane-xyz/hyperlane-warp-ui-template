import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { fromWei, fromWeiRounded } from '@hyperlane-xyz/utils';

import type { BalanceToken } from './types';
import { balanceTokenKey, getBalanceTokenKey } from './types';

export { formatBalance, formatDisplayAmount, formatUsd } from '../../utils/amount';

interface PricedFeeComponent {
  chainId: number;
  tokenAddress: string;
  amount: bigint;
}

// Fee amounts need more precision than balances — gas fees can be ~1e-5
// native units which formatBalance's 4-decimal rounding renders as "0.0000".
export function formatFeeAmount(amount: bigint, decimals: number): string {
  return fromWeiRounded(amount.toString(), decimals, 8);
}

export function getUsdValue(
  token: BalanceToken,
  balances: Record<string, bigint>,
  prices: Record<string, number>,
): number | null {
  const key = getBalanceTokenKey(token);
  const bal = balances[key];
  if (bal == null || !token.coinGeckoId) return null;
  const price = prices[token.coinGeckoId];
  if (price == null) return null;
  return parseFloat(fromWei(bal.toString(), token.decimals)) * price;
}

export function resolveCoinGeckoId(
  component: PricedFeeComponent,
  tokenMap: Map<string, BalanceToken>,
): { coinGeckoId: string | undefined; decimals: number } {
  const t = tokenMap.get(balanceTokenKey(component.chainId, component.tokenAddress));
  return { coinGeckoId: t?.coinGeckoId, decimals: t?.decimals ?? 18 };
}

// Returns null if any component is unpriced — a partial sum would
// understate the total and mislead the % readout.
export function getTotalFeeUsd(
  components: PricedFeeComponent[],
  tokenMap: Map<string, BalanceToken>,
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

// Signed value change from source to destination. Negative means value lost
// to fees, swap slippage, or spread. Missing prices stay unknown.
export function getPriceImpactPercentage(
  inputUsd: number | null,
  outputUsd: number | null,
): number | null {
  if (
    inputUsd == null ||
    outputUsd == null ||
    !Number.isFinite(inputUsd) ||
    !Number.isFinite(outputUsd) ||
    inputUsd <= 0 ||
    outputUsd < 0
  ) {
    return null;
  }
  return ((outputUsd - inputUsd) / inputUsd) * 100;
}

export function getNativeTokenDenom(
  multiProvider: MultiProtocolProvider,
  chainName: string | undefined,
): string | undefined {
  if (!chainName) return undefined;
  return multiProvider.tryGetChainMetadata(chainName)?.nativeToken?.denom;
}
