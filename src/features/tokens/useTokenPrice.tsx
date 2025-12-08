import { Token } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { logger } from '../../utils/logger';
import { TransferFormValues } from '../transfer/types';
import { getTokenByKey, useOriginTokens } from './hooks';

const TOKEN_PRICE_REFRESH_INTERVAL = 60_000; // 60s

export function useTokenPrice({ originTokenKey }: TransferFormValues) {
  const originTokens = useOriginTokens();
  const originToken = getTokenByKey(originTokens, originTokenKey);

  const { data, isError, isLoading } = useQuery({
    // The WarpCore class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['useTokenPrice', originToken?.coinGeckoId],
    queryFn: () => fetchTokenPrice(originToken),
    enabled: !!originToken?.coinGeckoId,
    staleTime: TOKEN_PRICE_REFRESH_INTERVAL,
    refetchInterval: TOKEN_PRICE_REFRESH_INTERVAL,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

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
}
