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
  //   chainId: 11155111,
  //   name: 'Ether',
  //   symbol: 'ETH',
  //   decimals: 18,
  //   hypNativeAddress: '0xEa44A29da87B5464774978e6A4F4072A4c048949',
  //   logoURI: '/logos/weth.png',
  // },
  // Example Solana token
  {
    type: 'collateral',
    protocol: 'sealevel',
    chainId: 1399811149,
    address: '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
    hypCollateralAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
    name: 'Sol',
    symbol: 'SOL',
    decimals: 9,
  },
];
