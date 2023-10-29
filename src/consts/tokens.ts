import { WarpTokenConfig } from '../features/tokens/types';

export const tokenList: WarpTokenConfig = [
  // Example collateral token for an EVM chain
  // {
  //   type: 'collateral',
  //   chainId: 5,
  //   address: '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
  //   hypCollateralAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
  //   name: 'Weth',
  //   symbol: 'WETH',
  //   decimals: 18,
  //   logoURI: '/logos/weth.png', // See public/logos/
  // },

  // Example native token for an EVM chain
  // {
  //   type: 'native',
  //   chainId: 11155111,
  //   name: 'Ether',
  //   symbol: 'ETH',
  //   decimals: 18,
  //   hypNativeAddress: '0xEa44A29da87B5464774978e6A4F4072A4c048949',
  //   logoURI: '/logos/weth.png',
  // },

  // Example NFT (ERC721) token for an EVM chain
  // {
  //   chainId: 5,
  //   name: 'Test721',
  //   symbol: 'TEST721',
  //   decimals: 0,
  //   type: 'collateral',
  //   address: '0x77566D540d1E207dFf8DA205ed78750F9a1e7c55',
  //   hypCollateralAddress: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
  //   isNft: true,
  // },

  // Neutron token
  {
    type: 'collateral',
    chainId: 'duality-devnet',
    name: 'Neutron',
    symbol: 'IBC',
    decimals: 6,
    address: "ibc/B5CB286F69D48B2C4F6F8D8CF59011C40590DCF8A91617A5FBA9FF0A7B21307F",
    hypCollateralAddress: 'dual1nzkcccxw00u9egqfuuq2ue23hjj6kxmfvmc5y0r7wchk5e6nypns6768kk',
    logoURI: '/logos/neutron.svg',
  },
];
