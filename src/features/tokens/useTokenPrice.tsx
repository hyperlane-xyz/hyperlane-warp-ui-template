import { isNullish } from '@hyperlane-xyz/utils';
import { useDebounce } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { logger } from '../../utils/logger';
import { useStore } from '../store';
import type { UiToken } from './types';

interface PriceCacheEntry {
  usd?: number;
  fetchedAt?: number;
  failedAt?: number;
}

type PriceCache = Record<string, PriceCacheEntry>;
type MergeFn = (
  succeededIds: string[],
  fetched: Record<string, number>,
  failedIds: string[],
) => void;

const PRICE_CACHE_MS = 15 * 60_000;
const FAILED_BACKOFF_MS = 90_000;
const COINGECKO_BATCH = 100;
const CHUNK_DELAY_MS = 200;

type CoinGeckoResponse = Record<string, { usd: number }>;

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
  requestedIds: string[];
  prices: Record<string, number>;
}

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
  if (failedIds.length > 0) {
    throw new Error(`CoinGecko fetch incomplete: ${failedIds.length} id(s) failed`);
  }
  return null;
}

export function useTokenPricesByIds(ids: string[]): {
  prices: Record<string, number>;
  isLoading: boolean;
} {
  const tokenPrices = useStore((s) => s.tokenPrices);
  const mergeTokenPrices = useStore((s) => s.mergeTokenPrices);
  const debouncedIds = useDebounce(ids, 300);

  const { isLoading } = useQuery({
    queryKey: ['tokenPrices', debouncedIds],
    queryFn: () => fetchTokenPrices(debouncedIds, tokenPrices, mergeTokenPrices),
    enabled: debouncedIds.length > 0,
    refetchInterval: PRICE_CACHE_MS / 2,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: FAILED_BACKOFF_MS,
  });

  const prices = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, entry] of Object.entries(tokenPrices)) {
      if (entry.usd != null) out[id] = entry.usd;
    }
    return out;
  }, [tokenPrices]);

  return { prices, isLoading };
}

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
// store cache populated (see TransferFormContent). Per-id selector keeps
// consumers from re-rendering on unrelated tokenPrices mutations.
export function useTokenUsdValue(token: UiToken | undefined, amount: string): number | null {
  const id = token?.coinGeckoId;
  const price = useStore((s) => (id ? s.tokenPrices[id]?.usd : undefined));
  return useMemo(() => getTokenUsdValue(price, amount), [amount, price]);
}

// Enforcement must fail open when the cached price is stale or its latest
// refresh failed. Display-only callers can continue using useTokenUsdValue.
export function useFreshTokenUsdValue(token: UiToken | undefined, amount: string): number | null {
  const id = token?.coinGeckoId;
  const entry = useStore((s) => (id ? s.tokenPrices[id] : undefined));
  return useMemo(() => getFreshTokenUsdValue(entry, amount), [amount, entry]);
}

function getTokenUsdValue(price: number | undefined, amount: string): number | null {
  // Strip grouping separators — parseFloat("1,234.56") returns 1 otherwise.
  const parsedAmount = parseFloat(String(amount ?? '').replace(/,/g, ''));
  if (!price || !Number.isFinite(parsedAmount)) return null;
  return parsedAmount * price;
}

export function getFreshTokenUsdValue(
  entry: PriceCacheEntry | undefined,
  amount: string,
  now = Date.now(),
): number | null {
  if (isNullish(entry?.fetchedAt) || now - entry.fetchedAt >= PRICE_CACHE_MS) return null;
  if (!isNullish(entry.failedAt) && entry.failedAt >= entry.fetchedAt) return null;
  return getTokenUsdValue(entry.usd, amount);
}
