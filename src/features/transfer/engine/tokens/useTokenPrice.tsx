import { useMemo } from 'react';

import { useStore } from '../../../store';
import { useTokenPricesByIds } from '../../../tokens/useTokenPrice';
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

// USD value of a token `amount` string. Returns null when there's no info
// (no coinGeckoId, no cached price, NaN/Infinity amount) so call sites can
// distinguish "no data → $0.00" from "tiny positive → <$0.01" via formatUsd.
// Pure read — relies on a parent mounting `useTokenPrices()` to keep the
// store cache populated (see SwapFormContent). Per-id selector keeps
// consumers from re-rendering on unrelated tokenPrices mutations.
export function useTokenUsdValue(token: UiToken | undefined, amount: string): number | null {
  const id = token?.coinGeckoId;
  const price = useStore((s) => (id ? s.tokenPrices[id]?.usd : undefined));
  return useMemo(() => {
    // Strip grouping separators — parseFloat("1,234.56") returns 1 otherwise.
    const a = parseFloat(String(amount ?? '').replace(/,/g, ''));
    if (!price || !Number.isFinite(a)) return null;
    return a * price;
  }, [amount, price]);
}
