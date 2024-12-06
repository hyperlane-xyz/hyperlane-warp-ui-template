import { TokenConnectionType, TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    // TIA Celestia to Neutron and Stride
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
        // To Manta Pacific via Neutron
        {
          token: 'ethereum|mantapacific|0x6Fae4D9935E2fcb11fC79a64e917fb2BF14DaFaa',
          type: TokenConnectionType.IbcHyperlane,
          sourcePort: 'transfer',
          sourceChannel: 'channel-8',
          intermediateChainName: 'neutron',
          intermediateRouterAddress:
            'neutron1ch7x3xgpnj62weyes8vfada35zff6z59kt2psqhnx9gjnt2ttqdqtva3pa',
          intermediateIbcDenom:
            'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
        },
        // To Stride
        {
          token:
            'cosmos|stride|ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801',
          type: TokenConnectionType.Ibc,
          sourcePort: 'transfer',
          sourceChannel: 'channel-4',
        },
        // To Eclipse via Stride
        {
          token: 'sealevel|eclipsemainnet|BpXHAiktwjx7fN6M9ST9wr6qKAsH27wZFhdHEhReJsR6',
          type: TokenConnectionType.IbcHyperlane,
          sourcePort: 'transfer',
          sourceChannel: 'channel-4',
          intermediateChainName: 'stride',
          intermediateRouterAddress:
            'stride1pvtesu3ve7qn7ctll2x495mrqf2ysp6fws68grvcu6f7n2ajghgsh2jdj6',
          intermediateIbcDenom:
            'ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801',
        },
      ],
    },

    // TIA on Neutron from Celestia
    {
      chainName: 'neutron',
      standard: TokenStandard.CosmosIbc,
      name: 'TIA.n',
      symbol: 'TIA.n',
      decimals: 6,
      addressOrDenom: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
      logoURI: '/deployments/warp_routes/TIA/logo.svg',
      connections: [
        {
          token: 'cosmos|celestia|utia',
          type: TokenConnectionType.Ibc,
          sourcePort: 'transfer',
          sourceChannel: 'channel-35',
        },
      ],
    },

    // TIA on Stride from Celestia
    {
      chainName: 'stride',
      standard: TokenStandard.CosmosIbc,
      name: 'Celestia',
      symbol: 'TIA',
      decimals: 6,
      addressOrDenom: 'ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801',
      logoURI: '/deployments/warp_routes/TIA/logo.svg',
      connections: [
        {
          token: 'cosmos|celestia|utia',
          type: TokenConnectionType.Ibc,
          sourcePort: 'transfer',
          sourceChannel: 'channel-162',
        },
      ],
    },
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
      {
        origin: 'celestia',
        destination: 'eclipsemainnet',
        amount: 120000,
        addressOrDenom: 'utia',
      },
    ],
  },
};
