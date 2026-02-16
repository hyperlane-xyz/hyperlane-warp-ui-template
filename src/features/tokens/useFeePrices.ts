import { WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { logger } from '../../utils/logger';

const FEE_PRICE_REFRESH_INTERVAL = 60_000;

export type FeePrices = Record<string, number>;

export function useFeePrices(fees: WarpCoreFeeEstimate | null): FeePrices {
  const coinGeckoIds = fees
    ? [
        ...new Set(
          [fees.localQuote, fees.interchainQuote, fees.tokenFeeQuote]
            .filter((q) => q && q.amount > 0n)
            .map((q) => q!.token.coinGeckoId)
            .filter((id): id is string => !!id),
        ),
      ]
    : [];

  const { data } = useQuery({
    queryKey: ['useFeePrices', coinGeckoIds],
    queryFn: () => fetchFeePrices(coinGeckoIds),
    enabled: coinGeckoIds.length > 0,
    staleTime: FEE_PRICE_REFRESH_INTERVAL,
    refetchInterval: FEE_PRICE_REFRESH_INTERVAL,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return data ?? {};
}

type CoinGeckoResponse = Record<string, { usd: number }>;

async function fetchFeePrices(ids: string[]): Promise<FeePrices> {
  if (!ids.length) return {};
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`,
    );
    if (!res.ok) {
      logger.warn(`CoinGecko fee price error: ${res.status}`);
      return {};
    }
    const data: CoinGeckoResponse = await res.json();
    const prices: FeePrices = {};
    for (const [id, val] of Object.entries(data)) {
      if (val?.usd) prices[id] = val.usd;
    }
    return prices;
  } catch (error) {
    logger.warn('Failed to fetch fee prices', error);
    return {};
  }
}
