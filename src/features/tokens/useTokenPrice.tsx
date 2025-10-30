import { WarpCore } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { logger } from '../../utils/logger';
import { TransferFormValues } from '../transfer/types';
import { getTokenByIndex, useWarpCore } from './hooks';

export function useTokenPrice({ tokenIndex }: TransferFormValues) {
  const warpCore = useWarpCore();

  const { data, isError } = useQuery({
    // The WarpCore class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['useTokenPrice', tokenIndex],
    queryFn: () => fetchTokenPrice(warpCore, tokenIndex),
    enabled: true,
    refetchInterval: 30_000,
  });

  return { tokenPrice: data, isError };
}

type CoinGeckoResponse = Record<string, { usd: number }>;

async function fetchTokenPrice(warpCore: WarpCore, tokenIndex?: number): Promise<number | null> {
  const originToken = getTokenByIndex(warpCore, tokenIndex);

  if (!originToken || !originToken.coinGeckoId) return null;
  logger.debug('Fetching token price');

  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${originToken.coinGeckoId}&vs_currencies=usd`,
  );
  const data: CoinGeckoResponse = await res.json();

  const priceData = Object.values(data)[0];
  return priceData?.usd ?? null;
}
