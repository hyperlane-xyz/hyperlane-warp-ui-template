import { Token } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { TransferFormValues } from '../transfer/types';
import { fetchCoinGeckoPrices } from './fetchCoinGeckoPrices';
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
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { tokenPrice: data, isError, isLoading };
}

async function fetchTokenPrice(originToken?: Token): Promise<number | null> {
  if (!originToken || !originToken.coinGeckoId) return null;
  const prices = await fetchCoinGeckoPrices([originToken.coinGeckoId]);
  return prices[originToken.coinGeckoId] ?? null;
}
