import { WarpTokenConfig } from '../features/tokens/types';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenList: WarpTokenConfig = [
  {
    type: 'ibc-native',
    chainId: 'injective-1',
    name: 'Injective',
    symbol: 'INJ',
    decimals: 6,
    logoURI: '/logos/ECLIP.png',
  },
];
