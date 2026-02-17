import { Token } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { logger } from '../../utils/logger';
import { TransferFormValues } from '../transfer/types';
import { getTokenByIndex, useWarpCore } from './hooks';

const TOKEN_PRICE_REFRESH_INTERVAL = 60_000; // 60s

type CoinGeckoResponse = Record<string, { usd: number }>;

/** Fetch USD prices from CoinGecko for one or more coinGeckoIds. */
async function fetchPrices(ids: string[]): Promise<Record<string, number>> {
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

export function useTokenPrice({ tokenIndex }: TransferFormValues) {
  const warpCore = useWarpCore();
  const originToken = getTokenByIndex(warpCore, tokenIndex);
  const coinGeckoId = originToken?.coinGeckoId;

  const { data, isError, isLoading } = useQuery({
    // The WarpCore class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['useTokenPrice', coinGeckoId],
    queryFn: async () => {
      if (!coinGeckoId) return null;
      const prices = await fetchPrices([coinGeckoId]);
      return prices[coinGeckoId] ?? null;
    },
    enabled: !!coinGeckoId,
    staleTime: TOKEN_PRICE_REFRESH_INTERVAL,
    refetchInterval: TOKEN_PRICE_REFRESH_INTERVAL,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { tokenPrice: data, isError, isLoading };
}

/**
 * Batch-fetch USD prices for multiple tokens via CoinGecko.
 * Returns Record<coinGeckoId, usdPrice>.
 */
export function useTokenPrices(tokens: Token[], origin: ChainName, destination: ChainName) {
  const coinGeckoIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tokens) {
      if (t.coinGeckoId) ids.add(t.coinGeckoId);
    }
    return Array.from(ids);
  }, [tokens]);

  const { data, isLoading } = useQuery({
    queryKey: ['tokenPrices', origin, destination, coinGeckoIds],
    queryFn: () => fetchPrices(coinGeckoIds),
    enabled: coinGeckoIds.length > 0,
    staleTime: TOKEN_PRICE_REFRESH_INTERVAL,
    refetchInterval: TOKEN_PRICE_REFRESH_INTERVAL,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { prices: data ?? {}, isLoading };
}
