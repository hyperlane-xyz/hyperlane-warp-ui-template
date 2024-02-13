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

  // Injective USDC
  {
    type: 'collateral',
    chainId: 1,
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    hypCollateralAddress: '0xED56728fb977b0bBdacf65bCdD5e17Bb7e84504f',
    logoURI: '/logos/usdc.svg',
  },

  // Injective USDT
  {
    type: 'collateral',
    chainId: 1,
    name: 'USDT',
    symbol: 'USDT',
    decimals: 6,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    hypCollateralAddress: '0xab852e67bf03E74C89aF67C4BA97dd1088D3dA19',
    logoURI: '/logos/usdt.svg',
  },
];
