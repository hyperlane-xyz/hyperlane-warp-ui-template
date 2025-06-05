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

    {
      chainName: 'arbitrumsepolia',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0xcc8D60a0575E1FB0892B8D03e79d06372b0Db5db',
      collateralAddressOrDenom: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      connections: [
        {
          token: 'ethereum|basesepolia|0xe288A3D1DAE7D894F7d829d967D5129e1b5f6468',
        },
        {
          token: 'ethereum|modetestnet|0x16C20625B11E0c8187Cc1B3e4ceedc35C48D8013',
        },
        {
          token: 'ethereum|optimismsepolia|0x991b90FCa036F2D94584D05a281c65352729B984',
        },
        {
          token: 'ethereum|sepolia|0xC96f21e32062B3D616b09110584ef2E54DC3d632',
        },
      ],
    },

    {
      chainName: 'basesepolia',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0xe288A3D1DAE7D894F7d829d967D5129e1b5f6468',
      collateralAddressOrDenom: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      connections: [
        {
          token: 'ethereum|arbitrumsepolia|0xcc8D60a0575E1FB0892B8D03e79d06372b0Db5db',
        },
        {
          token: 'ethereum|modetestnet|0x16C20625B11E0c8187Cc1B3e4ceedc35C48D8013',
        },
        {
          token: 'ethereum|optimismsepolia|0x991b90FCa036F2D94584D05a281c65352729B984',
        },
        {
          token: 'ethereum|sepolia|0xC96f21e32062B3D616b09110584ef2E54DC3d632',
        },
      ],
    },

    {
      chainName: 'modetestnet',
      standard: TokenStandard.EvmHypSynthetic,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0x16C20625B11E0c8187Cc1B3e4ceedc35C48D8013',
      connections: [
        {
          token: 'ethereum|arbitrumsepolia|0xcc8D60a0575E1FB0892B8D03e79d06372b0Db5db',
        },
        {
          token: 'ethereum|basesepolia|0xe288A3D1DAE7D894F7d829d967D5129e1b5f6468',
        },
        {
          token: 'ethereum|optimismsepolia|0x991b90FCa036F2D94584D05a281c65352729B984',
        },
        {
          token: 'ethereum|sepolia|0xC96f21e32062B3D616b09110584ef2E54DC3d632',
        },
      ],
    },

    {
      chainName: 'optimismsepolia',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0x991b90FCa036F2D94584D05a281c65352729B984',
      collateralAddressOrDenom: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
      connections: [
        {
          token: 'ethereum|arbitrumsepolia|0xcc8D60a0575E1FB0892B8D03e79d06372b0Db5db',
        },
        {
          token: 'ethereum|basesepolia|0xe288A3D1DAE7D894F7d829d967D5129e1b5f6468',
        },
        {
          token: 'ethereum|modetestnet|0x16C20625B11E0c8187Cc1B3e4ceedc35C48D8013',
        },
        {
          token: 'ethereum|sepolia|0xC96f21e32062B3D616b09110584ef2E54DC3d632',
        },
      ],
    },

    {
      chainName: 'sepolia',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0xC96f21e32062B3D616b09110584ef2E54DC3d632',
      collateralAddressOrDenom: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      connections: [
        {
          token: 'ethereum|arbitrumsepolia|0xcc8D60a0575E1FB0892B8D03e79d06372b0Db5db',
        },
        {
          token: 'ethereum|basesepolia|0xe288A3D1DAE7D894F7d829d967D5129e1b5f6468',
        },
        {
          token: 'ethereum|modetestnet|0x16C20625B11E0c8187Cc1B3e4ceedc35C48D8013',
        },
        {
          token: 'ethereum|optimismsepolia|0x991b90FCa036F2D94584D05a281c65352729B984',
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
        amount: 500000,
        addressOrDenom: 'utia',
      },
    ],
  },
};
