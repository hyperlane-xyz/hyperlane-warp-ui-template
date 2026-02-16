import { IToken, Token, WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { logger } from '../../utils/logger';

const FEE_PRICE_REFRESH_INTERVAL = 60_000;

// Maps fee token symbol to its CoinGecko USD price
export type FeePrices = Record<string, number>;

// SDK fee tokens lack coinGeckoId. Resolve it by matching against warp core
// tokens which carry coinGeckoId from config.
function resolveCoinGeckoId(feeToken: IToken, knownTokens: Token[]): string | undefined {
  if (feeToken.coinGeckoId) return feeToken.coinGeckoId;
  for (const t of knownTokens) {
    if (t.symbol === feeToken.symbol && t.coinGeckoId) return t.coinGeckoId;
  }
  return undefined;
}

export function useFeePrices(fees: WarpCoreFeeEstimate | null, knownTokens: Token[]): FeePrices {
  // Build symbol→coinGeckoId map for fee tokens
  const symbolToId: Record<string, string> = {};
  if (fees) {
    for (const q of [fees.localQuote, fees.interchainQuote, fees.tokenFeeQuote]) {
      if (!q || q.amount === 0n) continue;
      const id = resolveCoinGeckoId(q.token, knownTokens);
      if (id) symbolToId[q.token.symbol] = id;
    }
  }

  const ids = [...new Set(Object.values(symbolToId))];

  const { data } = useQuery({
    queryKey: ['useFeePrices', ids],
    queryFn: () => fetchFeePrices(ids),
    enabled: ids.length > 0,
    staleTime: FEE_PRICE_REFRESH_INTERVAL,
    refetchInterval: FEE_PRICE_REFRESH_INTERVAL,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Return prices keyed by symbol for easy lookup from fee TokenAmounts
  if (!data) return {};
  const result: FeePrices = {};
  for (const [symbol, id] of Object.entries(symbolToId)) {
    if (data[id]) result[symbol] = data[id];
  }
  return result;
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
