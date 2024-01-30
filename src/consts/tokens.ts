import { WarpTokenConfig } from '../features/tokens/types';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenList: WarpTokenConfig = [
  // INJ on Injective
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

  // INJ on inEVM
  {
    type: 'native',
    chainId: 2525,
    name: 'Injective Coin',
    symbol: 'INJ',
    decimals: 18,
    hypNativeAddress: '0x26f32245fCF5Ad53159E875d5Cae62aEcf19c2d4',
    logoURI: '/logos/injective.svg',
  },
];
