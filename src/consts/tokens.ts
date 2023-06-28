import { WarpTokenConfig } from '../features/tokens/types';

export const tokenList: WarpTokenConfig = [
  // Example collateral token for an EVM chain
  {
    type: 'collateral',
    chainId: 5,
    address: '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
    hypCollateralAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
    name: 'Weth',
    symbol: 'WETH',
    decimals: 18,
    logoURI: '/logos/weth.png', // See public/logos/
  },

  // Example NFT (ERC721) token for an EVM chain
  {
    type: 'collateral',
    chainId: 5,
    address: '0xd03483b978461b3162CE9e4c80835b9E81E07018',
    hypCollateralAddress: '0x9a01dd4dD90dBc27a756Dce5B564D6468795ee14',
    name: 'MyToken',
    symbol: 'MTK',
    decimals: 0,
    isNft: true,
  },

  // Example native token for an EVM chain
  {
    type: 'native',
    chainId: 11155111,
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
    hypNativeAddress: '0xEa44A29da87B5464774978e6A4F4072A4c048949',
    logoURI: '/logos/weth.png',
  },

  // Example native token for a Sealevel (Solana) chain
  {
    type: 'native',
    protocol: 'sealevel',
    chainId: 1399811151,
    hypNativeAddress: '8dAgevgBAnhvxoB5mWNUfmXi6H8WLC3ZaP8poaRHkzaR',
    name: 'Sol',
    symbol: 'SOL',
    decimals: 9,
    logoURI: '/logos/solana.svg',
  },

  // Example collateral token for a Sealevel (Solana) chain
  {
    type: 'collateral',
    protocol: 'sealevel',
    chainId: 1399811151,
    address: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    hypCollateralAddress: 'A9QY6ZQ3t1T3Pk58gTx1vsSeH2B2AywwK2V7SpH2w2cC',
    name: 'dUSDC',
    symbol: 'dUSDC',
    decimals: 6,
    isSpl2022: false,
  },
];