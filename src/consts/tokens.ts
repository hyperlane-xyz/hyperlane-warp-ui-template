import { WarpTokenConfig } from '../features/tokens/types';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
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

  // TIA on Neutron to Manta
  {
    type: 'collateral',
    chainId: 'neutron-1',
    name: 'TIA.n',
    symbol: 'TIA.n',
    decimals: 6,
    address: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
    hypCollateralAddress: 'neutron1ch7x3xgpnj62weyes8vfada35zff6z59kt2psqhnx9gjnt2ttqdqtva3pa',
    logoURI: '/logos/celestia.png',
  },

  // TIA on Neutron to Arbitrum
  {
    type: 'collateral',
    chainId: 'neutron-1',
    name: 'TIA.n',
    symbol: 'TIA.n',
    decimals: 6,
    address: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
    hypCollateralAddress: 'neutron1jyyjd3x0jhgswgm6nnctxvzla8ypx50tew3ayxxwkrjfxhvje6kqzvzudq',
    logoURI: '/logos/celestia_logo.png',
  },

  // Native TIA
  {
    type: 'ibc-native',
    chainId: 'celestia',
    name: 'TIA',
    symbol: 'TIA',
    decimals: 6,
    logoURI: '/logos/celestia.png',
  },
];
