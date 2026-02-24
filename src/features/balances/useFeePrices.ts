import { IToken, Token, WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchPrices } from '../tokens/useTokenPrice';

const FEE_PRICE_REFRESH_INTERVAL = 300_000; // 5 min, matches PRICE_STALE_TIME

// Maps fee token symbol to its CoinGecko USD price
export type FeePrices = Record<string, number>;

// SDK fee tokens lack coinGeckoId. Resolve it by matching against warp core
// tokens which carry coinGeckoId from config.
function resolveCoinGeckoId(
  feeToken: IToken,
  knownTokens: Token[],
  resolvedSymbols: Record<string, string>,
): string | undefined {
  if (feeToken.coinGeckoId) return feeToken.coinGeckoId;
  if (resolvedSymbols[feeToken.symbol]) return resolvedSymbols[feeToken.symbol];
  for (const token of knownTokens) {
    if (!token.coinGeckoId) continue;
    if (token.chainName === feeToken.chainName && token.symbol === feeToken.symbol)
      return token.coinGeckoId;
  }
  // Fall back to symbol-only match (native tokens like ETH across chains share a CoinGecko ID)
  for (const token of knownTokens) {
    if (token.symbol === feeToken.symbol && token.coinGeckoId) return token.coinGeckoId;
  }
  return undefined;
}

/**
 * Resolves USD prices for fee tokens. First checks batch prices from useTokenPrices(),
 * then fetches only the missing ones from CoinGecko.
 */
export function useFeePrices(
  fees: WarpCoreFeeEstimate | null,
  knownTokens: Token[],
  batchPrices: Record<string, number>,
): FeePrices {
  // Fee tokens are native gas tokens whose symbol (e.g. "ETH") maps 1:1 to a
  // CoinGecko ID regardless of chain, so keying by symbol is safe here.
  const { symbolToId, missingIds } = useMemo(() => {
    const map: Record<string, string> = {};
    if (fees) {
      for (const quote of [fees.localQuote, fees.interchainQuote, fees.tokenFeeQuote]) {
        if (!quote || quote.amount === 0n) continue;
        const id = resolveCoinGeckoId(quote.token, knownTokens, map);
        if (id) map[quote.token.symbol] = id;
      }
    }
    // IDs not already covered by the batch useTokenPrices() fetch
    const missing = [...new Set(Object.values(map))].filter((id) => !(id in batchPrices));
    return { symbolToId: map, missingIds: missing };
  }, [fees, knownTokens, batchPrices]);

  const { data } = useQuery({
    queryKey: ['useFeePrices', missingIds],
    queryFn: () => fetchPrices(missingIds),
    enabled: missingIds.length > 0,
    staleTime: FEE_PRICE_REFRESH_INTERVAL,
    refetchInterval: FEE_PRICE_REFRESH_INTERVAL,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return useMemo(() => {
    const result: FeePrices = {};
    for (const [symbol, id] of Object.entries(symbolToId)) {
      // Prefer batch price, fall back to separately fetched price
      const price = batchPrices[id] ?? data?.[id];
      if (price != null) result[symbol] = price;
    }
    return result;
  }, [symbolToId, batchPrices, data]);
}
