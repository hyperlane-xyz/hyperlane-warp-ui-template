import { logger } from '../../utils/logger';

type CoinGeckoResponse = Record<string, { usd: number }>;

export async function fetchCoinGeckoPrices(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`,
    );
    if (!res.ok) {
      logger.warn(`CoinGecko API error: ${res.status} ${res.statusText}`);
      return {};
    }
    const data: CoinGeckoResponse = await res.json();
    const prices: Record<string, number> = {};
    for (const [id, val] of Object.entries(data)) {
      if (val?.usd) prices[id] = val.usd;
    }
    return prices;
  } catch (error) {
    logger.warn('Failed to fetch CoinGecko prices', error);
    return {};
  }
}
