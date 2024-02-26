import { Chains, TokenConnectionType, TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenConfigs: WarpCoreConfig = {
  tokens: [
    // TIA Celestia to Neutron
    {
      chainName: 'celestia',
      standard: TokenStandard.CosmosIbc,
      name: 'TIA',
      symbol: 'TIA',
      decimals: 6,
      addressOrDenom: 'utia',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token:
            'cosmos|neutron|ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
          type: TokenConnectionType.Ibc,
          sourcePort: 'transfer',
          sourceChannel: 'channel-8',
        },
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
      ],
    },

    // TIA on Neutron from Celestia
    {
      chainName: Chains.neutron,
      standard: TokenStandard.CosmosIbc,
      name: 'TIA.n',
      symbol: 'TIA.n',
      decimals: 6,
      addressOrDenom: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token: 'cosmos|celestia|utia',
          type: TokenConnectionType.Ibc,
          sourcePort: 'transfer',
          sourceChannel: 'channel-35',
        },
      ],
    },

    // TIA on Neutron to Arbitrum
    {
      chainName: Chains.neutron,
      standard: TokenStandard.CwHypCollateral,
      name: 'TIA.n',
      symbol: 'TIA.n',
      decimals: 6,
      addressOrDenom: 'neutron1jyyjd3x0jhgswgm6nnctxvzla8ypx50tew3ayxxwkrjfxhvje6kqzvzudq',
      collateralAddressOrDenom:
        'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
      logoURI: '/logos/celestia.png',
      connections: [{ token: 'ethereum|arbitrum|0xD56734d7f9979dD94FAE3d67C7e928234e71cD4C' }],
    },

    // TIA on Neutron to Manta
    {
      chainName: Chains.neutron,
      standard: TokenStandard.CwHypCollateral,
      name: 'TIA.n',
      symbol: 'TIA.n',
      decimals: 6,
      addressOrDenom: 'neutron1ch7x3xgpnj62weyes8vfada35zff6z59kt2psqhnx9gjnt2ttqdqtva3pa',
      collateralAddressOrDenom:
        'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
      logoURI: '/logos/celestia.png',
      connections: [{ token: 'ethereum|mantapacific|0x6Fae4D9935E2fcb11fC79a64e917fb2BF14DaFaa' }],
    },

    // ECLIP on Neutron
    {
      chainName: Chains.neutron,
      standard: TokenStandard.CwHypCollateral,
      name: 'Eclipse Fi',
      symbol: 'ECLIP',
      decimals: 6,
      addressOrDenom: 'neutron1dvzvf870mx9uf65uqhx40yzx9gu4xlqqq2pnx362a0ndmustww3smumrf5',
      collateralAddressOrDenom: 'factory/neutron10sr06r3qkhn7xzpw3339wuj77hu06mzna6uht0/eclip',
      igpTokenAddressOrDenom:
        'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
      logoURI: '/logos/ECLIP.png',
      connections: [{ token: 'ethereum|arbitrum|0x93ca0d85837FF83158Cd14D65B169CdB223b1921' }],
    },

    // TIA on Arbitrum from Neutron
    {
      chainName: Chains.arbitrum,
      standard: TokenStandard.EvmHypSynthetic,
      name: 'TIA.n',
      symbol: 'TIA.n',
      decimals: 6,
      addressOrDenom: '0xD56734d7f9979dD94FAE3d67C7e928234e71cD4C',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token:
            'cosmos|neutron|neutron1jyyjd3x0jhgswgm6nnctxvzla8ypx50tew3ayxxwkrjfxhvje6kqzvzudq',
        },
      ],
    },

    // ECLIP on Arbitrum from Neutron
    {
      chainName: Chains.arbitrum,
      standard: TokenStandard.EvmHypSynthetic,
      name: 'Eclipse Fi',
      symbol: 'ECLIP',
      decimals: 6,
      addressOrDenom: '0x93ca0d85837FF83158Cd14D65B169CdB223b1921',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token:
            'cosmos|neutron|neutron1dvzvf870mx9uf65uqhx40yzx9gu4xlqqq2pnx362a0ndmustww3smumrf5',
        },
      ],
    },

    // TIA on Manta from Neutron
    {
      chainName: Chains.mantapacific,
      standard: TokenStandard.EvmHypSynthetic,
      name: 'TIA.n',
      symbol: 'TIA.n',
      decimals: 6,
      addressOrDenom: '0x6Fae4D9935E2fcb11fC79a64e917fb2BF14DaFaa',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token:
            'cosmos|neutron|neutron1jyyjd3x0jhgswgm6nnctxvzla8ypx50tew3ayxxwkrjfxhvje6kqzvzudq',
        },
      ],
    },
  ],
  options: {
    igpQuoteConstants: [
      {
        origin: Chains.neutron,
        destination: Chains.arbitrum,
        amount: 270000,
        addressOrDenom: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
      },
      {
        origin: Chains.neutron,
        destination: Chains.mantapacific,
        amount: 270000,
        addressOrDenom: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
      },
      {
        origin: 'celestia',
        destination: Chains.arbitrum,
        amount: 270000,
        addressOrDenom: 'utia',
      },
      {
        origin: 'celestia',
        destination: Chains.mantapacific,
        amount: 270000,
        addressOrDenom: 'utia',
      },
    ],
  },
};
