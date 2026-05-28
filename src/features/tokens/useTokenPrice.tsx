import { useDebounce } from '@hyperlane-xyz/widgets';
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

/**
 * Fetch USD prices from CoinGecko for one or more coinGeckoIds. Throws on
 * network or HTTP errors so callers can distinguish a real failure from a
 * 200-OK-with-missing-ids (legit "CoinGecko has no price for this id").
 */
export async function fetchPrices(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`,
  );
  if (!res.ok) {
    throw new Error(`CoinGecko ${res.status} ${res.statusText}`);
  }
  const data: CoinGeckoResponse = await res.json();
  const result: Record<string, number> = {};
  for (const [id, priceData] of Object.entries(data)) {
    if (priceData?.usd != null) result[id] = priceData.usd;
  }
  return result;
}

interface BatchedFetchResult {
  /** IDs from chunks that resolved successfully — safe to negative-cache. */
  requestedIds: string[];
  prices: Record<string, number>;
}

// Per-chunk Promise.allSettled so a 429 on one chunk doesn't poison the
// rest. Only successful chunks contribute to `requestedIds` / `prices`;
// failed chunks' IDs stay uncached and become eligible for refetch on
// the next render.
async function fetchPricesBatched(ids: string[]): Promise<BatchedFetchResult> {
  if (ids.length === 0) return { requestedIds: [], prices: {} };
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += COINGECKO_BATCH) {
    chunks.push(ids.slice(i, i + COINGECKO_BATCH));
  }
  const results = await Promise.allSettled(chunks.map(fetchPrices));
  const requestedIds: string[] = [];
  const prices: Record<string, number> = {};
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      requestedIds.push(...chunks[i]);
      Object.assign(prices, r.value);
    } else {
      logger.warn('Failed to fetch token prices chunk', r.reason);
    }
  }
  return { requestedIds, prices };
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
  // Debounce the input id set — rapid catalogue growth (e.g. picker
  // browsing chains) batches into one queryKey update instead of firing
  // redundant in-flight fetches that all overlap on the same IDs.
  const debouncedIds = useDebounce(ids, 300);

  const idsToFetch = useMemo(() => {
    const now = Date.now();
    return debouncedIds.filter((id) => {
      const entry = tokenPrices[id];
      return !entry || now - entry.fetchedAt > PRICE_CACHE_MS;
    });
  }, [debouncedIds, tokenPrices]);

  const { isLoading } = useQuery({
    queryKey: ['tokenPrices', idsToFetch],
    queryFn: async () => {
      const { requestedIds, prices } = await fetchPricesBatched(idsToFetch);
      // Partial: merge what we got. Next render's `idsToFetch` shrinks
      // to just the still-missing IDs → fresh queryKey fires a follow-up
      // fetch for those automatically.
      if (requestedIds.length > 0) {
        mergeTokenPrices(requestedIds, prices);
        return prices;
      }
      // Total failure: throw so TQ marks errored + retries (default 3x
      // with exp backoff). Returning {} here would cache an empty
      // "success" and lock the same queryKey out of refetching.
      throw new Error('All CoinGecko price chunks failed');
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
