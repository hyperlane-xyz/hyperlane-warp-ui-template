import { useQuery } from '@tanstack/react-query';
import { logger } from '../../utils/logger';
import { useStore } from '../store';

const PRICE_STALE_TIME = 300_000; // 5 min

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

/**
 * Batch-fetch USD prices for all tokens via CoinGecko.
 * Uses deduplicated coinGeckoIds from the store (computed during init).
 * Single query shared across all consumers via TanStack Query deduplication.
 */
export function useTokenPrices() {
  const coinGeckoIds = useStore((s) => s.coinGeckoIds);

  const { data, isLoading } = useQuery({
    queryKey: ['tokenPrices', coinGeckoIds],
    queryFn: () => fetchPrices(coinGeckoIds),
    enabled: coinGeckoIds.length > 0,
    staleTime: PRICE_STALE_TIME,
    refetchInterval: PRICE_STALE_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { prices: data ?? {}, isLoading };
}
