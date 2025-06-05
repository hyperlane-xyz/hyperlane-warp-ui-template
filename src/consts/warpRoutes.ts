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
      chainName: 'avalanche',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0x44c4e1d8872847BBF9Ab1479A994A7bEBF24B957',
      collateralAddressOrDenom: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      connections: [
        {
          token: 'ethereum|avalanche|0x44c4e1d8872847BBF9Ab1479A994A7bEBF24B957',
        },
        {
          token: 'ethereum|optimism|0x40710E1206C15029DB25e07eBad80B4d9246BB46',
        },
        {
          token: 'ethereum|arbitrum|0x52755EE22e6e4D7f144C4fB09c409e2B0A691d6D',
        },
        {
          token: 'ethereum|bsc|0x42DbD98966B4ec9C1CC33c1AA45a0a08a4f772E0',
        },
        {
          token: 'ethereum|unichain|0xE15216b866349d789b17c85A4edC81AadfC410CE',
        },
        {
          token: 'ethereum|base|0xF27A5F084d5546d6e2bf843D3E30dCA4b9bE7dC3',
        },
        {
          token: 'ethereum|ethereum|0x16B16094B018678b9EFa77AEDE41C4cbeF063c7e',
        },
      ],
    },

    {
      chainName: 'optimism',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0x40710E1206C15029DB25e07eBad80B4d9246BB46',
      collateralAddressOrDenom: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
      connections: [
        {
          token: 'ethereum|avalanche|0x44c4e1d8872847BBF9Ab1479A994A7bEBF24B957',
        },
        {
          token: 'ethereum|optimism|0x40710E1206C15029DB25e07eBad80B4d9246BB46',
        },
        {
          token: 'ethereum|arbitrum|0x52755EE22e6e4D7f144C4fB09c409e2B0A691d6D',
        },
        {
          token: 'ethereum|bsc|0x42DbD98966B4ec9C1CC33c1AA45a0a08a4f772E0',
        },
        {
          token: 'ethereum|unichain|0xE15216b866349d789b17c85A4edC81AadfC410CE',
        },
        {
          token: 'ethereum|base|0xF27A5F084d5546d6e2bf843D3E30dCA4b9bE7dC3',
        },
        {
          token: 'ethereum|ethereum|0x16B16094B018678b9EFa77AEDE41C4cbeF063c7e',
        },
      ],
    },

    {
      chainName: 'arbitrum',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0x52755EE22e6e4D7f144C4fB09c409e2B0A691d6D',
      collateralAddressOrDenom: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      connections: [
        {
          token: 'ethereum|avalanche|0x44c4e1d8872847BBF9Ab1479A994A7bEBF24B957',
        },
        {
          token: 'ethereum|optimism|0x40710E1206C15029DB25e07eBad80B4d9246BB46',
        },
        {
          token: 'ethereum|arbitrum|0x52755EE22e6e4D7f144C4fB09c409e2B0A691d6D',
        },
        {
          token: 'ethereum|bsc|0x42DbD98966B4ec9C1CC33c1AA45a0a08a4f772E0',
        },
        {
          token: 'ethereum|unichain|0xE15216b866349d789b17c85A4edC81AadfC410CE',
        },
        {
          token: 'ethereum|base|0xF27A5F084d5546d6e2bf843D3E30dCA4b9bE7dC3',
        },
        {
          token: 'ethereum|ethereum|0x16B16094B018678b9EFa77AEDE41C4cbeF063c7e',
        },
      ],
    },

    {
      chainName: 'bsc',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0x42DbD98966B4ec9C1CC33c1AA45a0a08a4f772E0',
      collateralAddressOrDenom: '0x078d782b760474a361dda0af3839290b0ef57ad6',
      connections: [
        {
          token: 'ethereum|avalanche|0x44c4e1d8872847BBF9Ab1479A994A7bEBF24B957',
        },
        {
          token: 'ethereum|optimism|0x40710E1206C15029DB25e07eBad80B4d9246BB46',
        },
        {
          token: 'ethereum|arbitrum|0x52755EE22e6e4D7f144C4fB09c409e2B0A691d6D',
        },
        {
          token: 'ethereum|bsc|0x42DbD98966B4ec9C1CC33c1AA45a0a08a4f772E0',
        },
        {
          token: 'ethereum|unichain|0xE15216b866349d789b17c85A4edC81AadfC410CE',
        },
        {
          token: 'ethereum|base|0xF27A5F084d5546d6e2bf843D3E30dCA4b9bE7dC3',
        },
        {
          token: 'ethereum|ethereum|0x16B16094B018678b9EFa77AEDE41C4cbeF063c7e',
        },
      ],
    },

    {
      chainName: 'unichain',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0xE15216b866349d789b17c85A4edC81AadfC410CE',
      collateralAddressOrDenom: '0x078d782b760474a361dda0af3839290b0ef57ad6',
      connections: [
        {
          token: 'ethereum|avalanche|0x44c4e1d8872847BBF9Ab1479A994A7bEBF24B957',
        },
        {
          token: 'ethereum|optimism|0x40710E1206C15029DB25e07eBad80B4d9246BB46',
        },
        {
          token: 'ethereum|arbitrum|0x52755EE22e6e4D7f144C4fB09c409e2B0A691d6D',
        },
        {
          token: 'ethereum|bsc|0x42DbD98966B4ec9C1CC33c1AA45a0a08a4f772E0',
        },
        {
          token: 'ethereum|unichain|0xE15216b866349d789b17c85A4edC81AadfC410CE',
        },
        {
          token: 'ethereum|base|0xF27A5F084d5546d6e2bf843D3E30dCA4b9bE7dC3',
        },
        {
          token: 'ethereum|ethereum|0x16B16094B018678b9EFa77AEDE41C4cbeF063c7e',
        },
      ],
    },

    {
      chainName: 'base',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0xF27A5F084d5546d6e2bf843D3E30dCA4b9bE7dC3',
      collateralAddressOrDenom: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      connections: [
        {
          token: 'ethereum|avalanche|0x44c4e1d8872847BBF9Ab1479A994A7bEBF24B957',
        },
        {
          token: 'ethereum|optimism|0x40710E1206C15029DB25e07eBad80B4d9246BB46',
        },
        {
          token: 'ethereum|arbitrum|0x52755EE22e6e4D7f144C4fB09c409e2B0A691d6D',
        },
        {
          token: 'ethereum|bsc|0x42DbD98966B4ec9C1CC33c1AA45a0a08a4f772E0',
        },
        {
          token: 'ethereum|unichain|0xE15216b866349d789b17c85A4edC81AadfC410CE',
        },
        {
          token: 'ethereum|base|0xF27A5F084d5546d6e2bf843D3E30dCA4b9bE7dC3',
        },
        {
          token: 'ethereum|ethereum|0x16B16094B018678b9EFa77AEDE41C4cbeF063c7e',
        },
      ],
    },

    {
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0x16B16094B018678b9EFa77AEDE41C4cbeF063c7e',
      collateralAddressOrDenom: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      connections: [
        {
          token: 'ethereum|avalanche|0x44c4e1d8872847BBF9Ab1479A994A7bEBF24B957',
        },
        {
          token: 'ethereum|optimism|0x40710E1206C15029DB25e07eBad80B4d9246BB46',
        },
        {
          token: 'ethereum|arbitrum|0x52755EE22e6e4D7f144C4fB09c409e2B0A691d6D',
        },
        {
          token: 'ethereum|bsc|0x42DbD98966B4ec9C1CC33c1AA45a0a08a4f772E0',
        },
        {
          token: 'ethereum|unichain|0xE15216b866349d789b17c85A4edC81AadfC410CE',
        },
        {
          token: 'ethereum|base|0xF27A5F084d5546d6e2bf843D3E30dCA4b9bE7dC3',
        },
        {
          token: 'ethereum|ethereum|0x16B16094B018678b9EFa77AEDE41C4cbeF063c7e',
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
