import { useMemo } from 'react';

import { useStore } from '../../store';
import { useTokenPricesByIds } from '../../tokens/useTokenPrice';
import type { UiToken } from './types';

// Swap-side prices: derive coinGeckoIds from the engine token catalogue
// (knownTokens grows as the user browses chains/tokens) and delegate to
// the shared store-backed cache. Overlapping IDs with the bridge tab
// (ETH, USDC, etc.) are fetched once total.
export function useTokenPrices(): { prices: Record<string, number>; isLoading: boolean } {
  const knownTokens = useStore((s) => s.knownTokens);

  const ids = useMemo(() => {
    const set = new Set<string>();
    for (const t of knownTokens.values()) {
      if (t.coinGeckoId) set.add(t.coinGeckoId);
    }
    return Array.from(set).sort();
  }, [knownTokens]);

  return useTokenPricesByIds(ids);
}

// USD value of a token `amount` string. Reads the single price via a
// parameterized selector so consumers don't re-render on unrelated
// tokenPrices mutations.
export function useTokenUsdValue(token: UiToken | undefined, amount: string): number {
  // Side-effect mount: keeps the catalogue-wide fetch hot for deep-linked
  // URLs where cards render before the picker opens.
  useTokenPrices();
  const id = token?.coinGeckoId;
  const price = useStore((s) => (id ? s.tokenPrices[id]?.usd : undefined));
  return useMemo(() => {
    // Strip grouping separators — parseFloat("1,234.56") returns 1 otherwise.
    const a = parseFloat(String(amount ?? '').replace(/,/g, ''));
    if (!price || isNaN(a)) return 0;
    return a * price;
  }, [amount, price]);
}
