import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { logger } from '../../utils/logger';
import { useStore } from '../store';

const PRICE_CACHE_MS = 60 * 60_000; // 1 hour
// CoinGecko /simple/price ids= has no documented hard limit. Rate limits
// are per-request (free tier ~5-15/min), so bigger batches = fewer
// requests = less throttling. 250 matches /coins/markets per_page cap.
const COINGECKO_BATCH = 250;

type CoinGeckoResponse = Record<string, { usd: number }>;

/** Fetch USD prices from CoinGecko for one or more coinGeckoIds. */
export async function fetchPrices(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`,
    );
    if (!res.ok) {
      logger.warn(`CoinGecko API error: ${res.status} ${res.statusText}`);
      return {};
    }
    const data: CoinGeckoResponse = await res.json();
    const result: Record<string, number> = {};
    for (const [id, priceData] of Object.entries(data)) {
      if (priceData?.usd != null) result[id] = priceData.usd;
    }
    return result;
  } catch (error) {
    logger.warn('Failed to fetch token prices', error);
    return {};
  }
}

async function fetchPricesBatched(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += COINGECKO_BATCH) {
    chunks.push(ids.slice(i, i + COINGECKO_BATCH));
  }
  const results = await Promise.all(chunks.map(fetchPrices));
  return Object.assign({}, ...results);
}

// Shared core: delta-fetch USD prices for `ids` into the store's
// `tokenPrices` cache. Already-cached entries < 1h old are reused —
// only the new IDs hit CoinGecko. Bridge + swap both wrap this with
// their own ID sources (warp routes vs engine token catalogue).
export function useTokenPricesByIds(ids: string[]): {
  prices: Record<string, number>;
  isLoading: boolean;
} {
  const tokenPrices = useStore((s) => s.tokenPrices);
  const mergeTokenPrices = useStore((s) => s.mergeTokenPrices);

  const idsToFetch = useMemo(() => {
    const now = Date.now();
    return ids.filter((id) => {
      const entry = tokenPrices[id];
      return !entry || now - entry.fetchedAt > PRICE_CACHE_MS;
    });
  }, [ids, tokenPrices]);

  const { isLoading } = useQuery({
    queryKey: ['tokenPrices', idsToFetch],
    queryFn: async () => {
      const fresh = await fetchPricesBatched(idsToFetch);
      mergeTokenPrices(idsToFetch, fresh);
      return fresh;
    },
    enabled: idsToFetch.length > 0,
    staleTime: PRICE_CACHE_MS,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Flatten { usd, fetchedAt } → number for the consumer shape.
  const prices = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, entry] of Object.entries(tokenPrices)) {
      if (entry.usd != null) out[id] = entry.usd;
    }
    return out;
  }, [tokenPrices]);

  return { prices, isLoading };
}

/** Bridge-side hook: prices the warpCore token set (built at init). */
export function useTokenPrices() {
  const coinGeckoIds = useStore((s) => s.coinGeckoIds);
  return useTokenPricesByIds(coinGeckoIds);
}
