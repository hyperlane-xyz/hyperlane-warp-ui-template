import { WarpTokenConfig } from '../features/tokens/types';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenList: WarpTokenConfig = [
  {
    type: 'native',
    chainId: 'injective-1',
    name: 'Injective Coin',
    symbol: 'INJ',
    decimals: 18,
    hypNativeAddress: 'inj1mv9tjvkaw7x8w8y9vds8pkfq46g2vcfkjehc6k',
    igpTokenAddressOrDenom: 'inj',
    logoURI: '/logos/injective.svg',
  },
];
