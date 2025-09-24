import { TokenConnectionType, TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    {
      chainName: 'celestia',
      standard: TokenStandard.CosmosIbc,
      name: 'TIA',
      symbol: 'TIA',
      decimals: 6,
      addressOrDenom: 'utia',
      logoURI: '/deployments/warp_routes/TIA/logo.svg',
      connections: [
        // To Neutron
        {
          token:
            'cosmos|neutron|ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
          type: TokenConnectionType.Ibc,
          sourcePort: 'transfer',
          sourceChannel: 'channel-8',
        },
        // To Arbitrum via Neutron
        {
          token: 'ethereum|arbitrum|0xD56734d7f9979dD94FAE3d67C7e928234e71cD4C',
          type: TokenConnectionType.IbcHyperlane,
          sourcePort: 'transfer',
          sourceChannel: 'channel-8',
          intermediateChainName: 'neutron',
          intermediateRouterAddress:
            'neutron1jyyjd3x0jhgswgm6nnctxvzla8ypx50tew3ayxxwkrjfxhvje6kqzvzudq',
          intermediateIbcDenom:
            'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
        },
      ],
    },
  ],
  options: {},
};
