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

    // USDCSTAGE - Eclipse Mainnet (Synthetic)
    {
      chainName: 'eclipsemainnet',
      standard: TokenStandard.SealevelHypSynthetic,
      name: 'USD Coin STAGE',
      symbol: 'USDCSTAGE',
      decimals: 6,
      addressOrDenom: '6QSWUmEaEcE2KJrU5jq7T11tNRaVsgnG8XULezjg7JjL',
      logoURI: '/deployments/warp_routes/USDCSTAGE/logo.svg',
      connections: [
        {
          token: 'ethereum|ethereum|0x04C26A1Efb87D5Ac9ee6179754B4CDDC61fC11d5',
          type: TokenConnectionType.Hyperlane,
        },
        {
          token: 'sealevel|solanamainnet|E5rVV8zXwtc4TKGypCJvSBaYbgxa4XaYg5MS6N9QGdeo',
          type: TokenConnectionType.Hyperlane,
        },
      ],
    },

    // USDCSTAGE - Ethereum (Collateral)
    {
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      name: 'USD Coin STAGE',
      symbol: 'USDCSTAGE',
      decimals: 6,
      addressOrDenom: '0x04C26A1Efb87D5Ac9ee6179754B4CDDC61fC11d5',
      collateralAddressOrDenom: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      logoURI: '/deployments/warp_routes/USDCSTAGE/logo.svg',
      connections: [
        {
          token: 'sealevel|eclipsemainnet|6QSWUmEaEcE2KJrU5jq7T11tNRaVsgnG8XULezjg7JjL',
          type: TokenConnectionType.Hyperlane,
        },
      ],
    },

    // USDCSTAGE - Solana Mainnet (Collateral)
    {
      chainName: 'solanamainnet',
      standard: TokenStandard.SealevelHypCollateral,
      name: 'USDCSTAGE',
      symbol: 'USDCSTAGE',
      decimals: 6,
      addressOrDenom: 'E5rVV8zXwtc4TKGypCJvSBaYbgxa4XaYg5MS6N9QGdeo',
      collateralAddressOrDenom: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      logoURI: '/deployments/warp_routes/USDCSTAGE/logo.svg',
      connections: [
        {
          token: 'sealevel|eclipsemainnet|6QSWUmEaEcE2KJrU5jq7T11tNRaVsgnG8XULezjg7JjL',
          type: TokenConnectionType.Hyperlane,
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
