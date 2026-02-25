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
        // To Stride
        {
          token:
            'cosmos|stride|ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801',
          type: TokenConnectionType.Ibc,
          sourcePort: 'transfer',
          sourceChannel: 'channel-4',
        },
      ],
    },

    // TIA Celestia to Eclipse via Stride
    {
      chainName: 'celestia',
      standard: TokenStandard.CosmosIbc,
      name: 'TIA.s',
      symbol: 'TIA.s',
      decimals: 6,
      addressOrDenom: 'utia',
      logoURI: '/deployments/warp_routes/TIA/logo.svg',
      connections: [
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

    {
      chainName: 'arbitrum',
      standard: TokenStandard.EvmHypNative,
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      addressOrDenom: '0x8A8260896199AB2c06C001438Fb20C47EdB0FdA5',
      connections: [
        {
          token: 'ethereum|optimism|0x82eEECE1c3b1F865243dC089d3Fb34E25557B34B',
          type: TokenConnectionType.Hyperlane,
        },
        {
          token: 'ethereum|base|0xB395706F4b1976499e8789F4a2bf82c4B3aa2b59',
          type: TokenConnectionType.Hyperlane,
        },
      ],
    },

    {
      chainName: 'optimism',
      standard: TokenStandard.EvmHypNative,
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      addressOrDenom: '0x82eEECE1c3b1F865243dC089d3Fb34E25557B34B',
      connections: [
        {
          token: 'ethereum|arbitrum|0x8A8260896199AB2c06C001438Fb20C47EdB0FdA5',
          type: TokenConnectionType.Hyperlane,
        },
        {
          token: 'ethereum|base|0xB395706F4b1976499e8789F4a2bf82c4B3aa2b59',
          type: TokenConnectionType.Hyperlane,
        },
      ],
    },

    {
      chainName: 'base',
      standard: TokenStandard.EvmHypSynthetic,
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      addressOrDenom: '0xB395706F4b1976499e8789F4a2bf82c4B3aa2b59',
      connections: [
        {
          token: 'ethereum|arbitrum|0x8A8260896199AB2c06C001438Fb20C47EdB0FdA5',
          type: TokenConnectionType.Hyperlane,
        },
        {
          token: 'ethereum|optimism|0x82eEECE1c3b1F865243dC089d3Fb34E25557B34B',
          type: TokenConnectionType.Hyperlane,
        },
      ],
    },
  ],
  options: {
    interchainFeeConstants: [
      {
        origin: 'celestia',
        destination: 'mantapacific',
        amount: 270000,
        addressOrDenom: 'utia',
      },
    ],
  },
};
