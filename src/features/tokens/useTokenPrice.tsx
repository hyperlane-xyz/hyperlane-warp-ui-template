import { useDebounce } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { logger } from '../../utils/logger';
import { useStore } from '../store';

type PriceCache = Record<string, { usd?: number; fetchedAt?: number; failedAt?: number }>;
type MergeFn = (
  succeededIds: string[],
  fetched: Record<string, number>,
  failedIds: string[],
) => void;

const PRICE_CACHE_MS = 15 * 60_000;
const FAILED_BACKOFF_MS = 30_000;
// 100 keeps the URL well under the ~6KB Cloudflare 414 threshold. Chunks run
// sequentially (free tier is ~5-15 req/min, parallel firing burns quota fast).
const COINGECKO_BATCH = 100;
const CHUNK_DELAY_MS = 200;

type CoinGeckoResponse = Record<string, { usd: number }>;

/**
 * Fetch USD prices from CoinGecko for one or more coinGeckoIds. Throws on
 * network or HTTP errors so callers can distinguish a real failure from a
 * 200-OK-with-missing-ids (legit "CoinGecko has no price for this id").
 */
export async function fetchPrices(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.map(encodeURIComponent).join(',')}&vs_currencies=usd`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`CoinGecko ${res.status} ${res.statusText}${body ? `: ${body}` : ''}`);
  }
  const data: CoinGeckoResponse = await res.json();
  const result: Record<string, number> = {};
  for (const [id, priceData] of Object.entries(data)) {
    if (priceData?.usd != null) result[id] = priceData.usd;
  }
  return result;
}

interface BatchedFetchResult {
  /** IDs from chunks that resolved successfully. */
  requestedIds: string[];
  prices: Record<string, number>;
}

// Per-chunk try/catch so a 429 on one chunk doesn't block the rest —
// failed chunks' IDs simply don't appear in `requestedIds`.
async function fetchPricesBatched(ids: string[]): Promise<BatchedFetchResult> {
  if (ids.length === 0) return { requestedIds: [], prices: {} };
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += COINGECKO_BATCH) {
    chunks.push(ids.slice(i, i + COINGECKO_BATCH));
  }
  const requestedIds: string[] = [];
  const prices: Record<string, number> = {};
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    const chunk = chunks[i];
    try {
      const result = await fetchPrices(chunk);
      requestedIds.push(...chunk);
      Object.assign(prices, result);
    } catch (e) {
      logger.warn('Failed to fetch token prices chunk', e);
    }
  }
  return { requestedIds, prices };
}

// Filter input IDs against the cache, fetch whatever is missing / stale /
// past its backoff window, and merge results back into the store. Called
// by both initial mount and the periodic refetch tick — on first call
// the cache is empty so every ID flows through.
async function fetchTokenPrices(ids: string[], cache: PriceCache, merge: MergeFn): Promise<null> {
  const now = Date.now();
  const idsToFetch = ids.filter((id) => {
    const entry = cache[id];
    if (!entry) return true;
    if (entry.fetchedAt && now - entry.fetchedAt < PRICE_CACHE_MS) return false;
    if (entry.failedAt && now - entry.failedAt < FAILED_BACKOFF_MS) return false;
    return true;
  });
  if (idsToFetch.length === 0) return null;
  const { requestedIds, prices } = await fetchPricesBatched(idsToFetch);
  const failedIds = idsToFetch.filter((id) => !requestedIds.includes(id));
  merge(requestedIds, prices, failedIds);
  if (requestedIds.length === 0) {
    throw new Error('All CoinGecko price chunks failed');
  }
  return null;
}

// Shared core: keep the store's `tokenPrices` cache fresh for `ids`. Bridge
// + swap wrap with their own ID sources (warp routes vs engine catalogue).
// TQ's `refetchInterval` drives periodic re-evaluation against the cache;
// queryFn is a no-op when nothing is stale.
export function useTokenPricesByIds(ids: string[]): {
  prices: Record<string, number>;
  isLoading: boolean;
} {
  const tokenPrices = useStore((s) => s.tokenPrices);
  const mergeTokenPrices = useStore((s) => s.mergeTokenPrices);
  // TODO: rapid `ids` churn during initial bootstrap can keep the 300ms
  // timer resetting and delay USD display on slow networks. Revisit with
  // a leading-edge debounce if it shows up in practice.
  const debouncedIds = useDebounce(ids, 300);

  const { isLoading } = useQuery({
    queryKey: ['tokenPrices', debouncedIds],
    queryFn: () => fetchTokenPrices(debouncedIds, tokenPrices, mergeTokenPrices),
    enabled: debouncedIds.length > 0,
    refetchInterval: PRICE_CACHE_MS / 2,
    refetchOnWindowFocus: false,
  });

  // Flatten the entry shape → bare USD numbers for consumers.
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
