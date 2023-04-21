import { WarpTokenConfig } from '../features/tokens/types';

export const tokenList: WarpTokenConfig = [
  // Example collateral token
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
  // Example native token
  // {
  //   type: 'native',
  //   chainId: 5,
  //   hypNativeAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
  //   name: 'ether',
  //   symbol: 'ETH',
  //   decimals: 18,
  //   logoURI: '/logos/weth.png',
  // },
];
