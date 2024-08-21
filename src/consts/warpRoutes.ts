import { WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    // TIA Celestia to Neutron
    // {
    //   chainName: 'celestia',
    //   standard: TokenStandard.CosmosIbc,
    //   name: 'TIA',
    //   symbol: 'TIA',
    //   decimals: 6,
    //   addressOrDenom: 'utia',
    //   logoURI: '/deployments/warp_routes/TIA/logo.svg',
    //   connections: [
    //     {
    //       token:
    //         'cosmos|neutron|ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
    //       type: TokenConnectionType.Ibc,
    //       sourcePort: 'transfer',
    //       sourceChannel: 'channel-8',
    //     },
    //     {
    //       token: 'ethereum|arbitrum|0xD56734d7f9979dD94FAE3d67C7e928234e71cD4C',
    //       type: TokenConnectionType.IbcHyperlane,
    //       sourcePort: 'transfer',
    //       sourceChannel: 'channel-8',
    //       intermediateChainName: 'neutron',
    //       intermediateRouterAddress:
    //         'neutron1jyyjd3x0jhgswgm6nnctxvzla8ypx50tew3ayxxwkrjfxhvje6kqzvzudq',
    //       intermediateIbcDenom:
    //         'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
    //     },
    //     {
    //       token: 'ethereum|mantapacific|0x6Fae4D9935E2fcb11fC79a64e917fb2BF14DaFaa',
    //       type: TokenConnectionType.IbcHyperlane,
    //       sourcePort: 'transfer',
    //       sourceChannel: 'channel-8',
    //       intermediateChainName: 'neutron',
    //       intermediateRouterAddress:
    //         'neutron1ch7x3xgpnj62weyes8vfada35zff6z59kt2psqhnx9gjnt2ttqdqtva3pa',
    //       intermediateIbcDenom:
    //         'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
    //     },
    //   ],
    // },
    // TIA on Neutron from Celestia
    // {
    //   chainName: 'neutron',
    //   standard: TokenStandard.CosmosIbc,
    //   name: 'TIA.n',
    //   symbol: 'TIA.n',
    //   decimals: 6,
    //   addressOrDenom: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
    //   logoURI: '/deployments/warp_routes/TIA/logo.svg',
    //   connections: [
    //     {
    //       token: 'cosmos|celestia|utia',
    //       type: TokenConnectionType.Ibc,
    //       sourcePort: 'transfer',
    //       sourceChannel: 'channel-35',
    //     },
    //   ],
    // },
  ],
  options: {
    interchainFeeConstants: [
      {
        origin: 'celestia',
        destination: 'arbitrum',
        amount: 270000,
        addressOrDenom: 'utia',
      },
      {
        origin: 'celestia',
        destination: 'mantapacific',
        amount: 270000,
        addressOrDenom: 'utia',
      },
    ],
  },
};
