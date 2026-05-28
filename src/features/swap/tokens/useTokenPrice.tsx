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

// Convenience: USD value of a decimal-formatted token `amount` string.
// Returns 0 when token has no coinGeckoId, no cached price, or the
// amount fails to parse.
export function useTokenUsdValue(token: UiToken | undefined, amount: string): number {
  const { prices } = useTokenPrices();
  const price = token?.coinGeckoId ? prices[token.coinGeckoId] : undefined;
  return useMemo(() => {
    // Coerce + strip grouping separators — Formik may hand us a number/null
    // and parseFloat("1,234.56") returns 1 without the strip.
    const a = parseFloat(String(amount ?? '').replace(/,/g, ''));
    if (!price || isNaN(a)) return 0;
    return a * price;
  }, [amount, price]);
}
