<<<<<<< HEAD
import { Token } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { logger } from '../../utils/logger';
import { TransferFormValues } from '../transfer/types';
import { getTokenByIndex, useWarpCore } from './hooks';

const TOKEN_PRICE_REFRESH_INTERVAL = 60_000; // 60s

export function useTokenPrice({ tokenIndex }: TransferFormValues) {
  const warpCore = useWarpCore();
  const originToken = getTokenByIndex(warpCore, tokenIndex);

  const { data, isError, isLoading } = useQuery({
    // The WarpCore class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['useTokenPrice', originToken?.coinGeckoId],
    queryFn: () => fetchTokenPrice(originToken),
    enabled: !!originToken?.coinGeckoId,
    staleTime: TOKEN_PRICE_REFRESH_INTERVAL,
    refetchInterval: TOKEN_PRICE_REFRESH_INTERVAL,
=======
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
>>>>>>> origin/main
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

<<<<<<< HEAD
  return { tokenPrice: data, isError, isLoading };
}

type CoinGeckoResponse = Record<string, { usd: number }>;

async function fetchTokenPrice(originToken?: Token): Promise<number | null> {
  if (!originToken || !originToken.coinGeckoId) return null;

  try {
    logger.debug('Fetching token price');

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${originToken.coinGeckoId}&vs_currencies=usd`,
    );
    if (!res.ok) {
      logger.warn(`CoinGecko API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data: CoinGeckoResponse = await res.json();
    const priceData = Object.values(data)[0];
    return priceData?.usd ?? null;
  } catch (error) {
    logger.warn('Failed to fetch token price', error);
    return null;
  }
=======
  return { prices: data ?? {}, isLoading };
>>>>>>> origin/main
}
