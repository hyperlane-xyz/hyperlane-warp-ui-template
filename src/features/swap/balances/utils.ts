import { fromWeiRounded } from '@hyperlane-xyz/utils';

import type { ChainDiscovery } from '../../api/types';
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
  return (Number(bal) / 10 ** token.decimals) * price;
}

// Sums the USD value of every fee component. ERC20 fees resolve their
// coinGeckoId via `tokenMap` (engine-discovered tokens); native fees
// resolve via the chain's `gasCurrencyCoinGeckoId`. Components whose
// coinGeckoId or price isn't known are silently skipped so a missing
// price doesn't zero out the whole readout.
export function getTotalFeeUsd(
  components: FeeComponent[],
  tokenMap: Map<string, UiToken>,
  chains: ChainDiscovery[] | undefined,
  prices: Record<string, number>,
): number {
  let total = 0;
  for (const c of components) {
    let coinGeckoId: string | undefined;
    let decimals = 18;
    if (/^0x0+$/i.test(c.tokenAddress)) {
      const chain = chains?.find((x) => x.id === c.chainId);
      coinGeckoId = chain?.gasCurrencyCoinGeckoId;
      decimals = chain?.nativeCurrency.decimals ?? 18;
    } else {
      const t = tokenMap.get(`${c.chainId}-${c.tokenAddress.toLowerCase()}`);
      coinGeckoId = t?.coinGeckoId;
      decimals = t?.decimals ?? 18;
    }
    if (!coinGeckoId) continue;
    const price = prices[coinGeckoId];
    if (price == null) continue;
    total += (Number(c.amount) / 10 ** decimals) * price;
  }
  return total;
}
