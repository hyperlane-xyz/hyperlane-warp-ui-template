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

  // ECLIP on Neutron to Arbitrum
  {
    type: 'collateral',
    chainId: 'neutron-1',
    name: 'Eclipse Fi',
    symbol: 'ECLIP',
    decimals: 6,
    address: 'factory/neutron10sr06r3qkhn7xzpw3339wuj77hu06mzna6uht0/eclip',
    hypCollateralAddress: 'neutron1dvzvf870mx9uf65uqhx40yzx9gu4xlqqq2pnx362a0ndmustww3smumrf5',
    igpTokenAddress: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
    logoURI: '/logos/ECLIP.png',
  },

  // // Ethereum Eth to Viction
  // {
  //   type: 'native',
  //   chainId: 1,
  //   name: 'Ether',
  //   symbol: 'ETH',
  //   decimals: 18,
  //   hypNativeAddress: '0x15b5D6B614242B118AA404528A7f3E2Ad241e4A4',
  //   logoURI: '/logos/weth.png',
  // },

  // // Ethereum USDC to Viction
  // {
  //   type: 'collateral',
  //   chainId: 1,
  //   name: 'USDC',
  //   symbol: 'USDC',
  //   decimals: 18,
  //   address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  //   hypCollateralAddress: '0x31Dca7762930f56D81292f85E65c9D67575804fE',
  //   logoURI: '/logos/usdc.svg',
  // },

  // // Ethereum USDT to Viction
  // {
  //   type: 'collateral',
  //   chainId: 1,
  //   name: 'USDT',
  //   symbol: 'USDT',
  //   decimals: 18,
  //   address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  //   hypCollateralAddress: '0x4221a16A01F61c2b38A03C52d828a7041f6AAA49',
  //   logoURI: '/logos/usdt.svg',
  // },
];
