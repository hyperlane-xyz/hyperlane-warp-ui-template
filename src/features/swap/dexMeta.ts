export interface DexMeta {
  name: string;
  logoUri: string;
}

export const DEX_META: Record<string, DexMeta> = {
  uniswap: {
    name: 'Uniswap',
    logoUri: 'https://assets.coingecko.com/coins/images/12504/standard/uniswap-logo.png?1720676669',
  },
  velodrome: {
    name: 'Velodrome',
    logoUri: 'https://assets.coingecko.com/coins/images/25783/standard/velo.png?1696524870',
  },
  aerodrome: {
    name: 'Aerodrome',
    logoUri: 'https://assets.coingecko.com/coins/images/31745/standard/token.png?1696530564',
  },
  pancakeswap: {
    name: 'PancakeSwap',
    logoUri:
      'https://assets.coingecko.com/coins/images/12632/standard/pancakeswap-cake-logo_%281%29.png?1696512440',
  },
  sunswap: {
    name: 'SunSwap',
    logoUri: 'https://assets.coingecko.com/coins/images/12424/standard/RSFOmQ.png?1696512245',
  },
};

export function getDexMeta(dexKey: string): DexMeta | undefined {
  return DEX_META[dexKey.toLowerCase()];
}
