import { Chains, TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

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
      // TODO source channel
      logoURI: '/logos/celestia.png',
      connectedTokens: [
        'cosmos|neutron|ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
        // TODO two-hop to Arbitrum via Neutron
        // TODO two-hop to Manta via Neutron
      ],
    },
    // TIA from Celestia on Neutron
    {
      chainName: Chains.neutron,
      standard: TokenStandard.CosmosIbc,
      name: 'TIA.n',
      symbol: 'TIA.n',
      decimals: 6,
      addressOrDenom: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
      // TODO source channel
      logoURI: '/logos/celestia.png',
      connectedTokens: ['cosmos|celestia|utia'],
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
      connectedTokens: ['ethereum|arbitrum|0xD56734d7f9979dD94FAE3d67C7e928234e71cD4C'],
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
      connectedTokens: ['ethereum|mantapacific|0x6Fae4D9935E2fcb11fC79a64e917fb2BF14DaFaa'],
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
      connectedTokens: ['ethereum|arbitrum|0x93ca0d85837FF83158Cd14D65B169CdB223b1921'],
    },
    // TIA from Neutron on Arbitrum
    {
      chainName: Chains.arbitrum,
      standard: TokenStandard.EvmHypSynthetic,
      name: 'TIA.n',
      symbol: 'TIA.n',
      decimals: 6,
      addressOrDenom: '0xD56734d7f9979dD94FAE3d67C7e928234e71cD4C',
      logoURI: '/logos/celestia.png',
      connectedTokens: [
        'cosmos|neutron|neutron1jyyjd3x0jhgswgm6nnctxvzla8ypx50tew3ayxxwkrjfxhvje6kqzvzudq',
      ],
    },
    // ECLIP from Neutron on Arbitrum
    {
      chainName: Chains.arbitrum,
      standard: TokenStandard.EvmHypSynthetic,
      name: 'Eclipse Fi',
      symbol: 'ECLIP',
      decimals: 6,
      addressOrDenom: '0x93ca0d85837FF83158Cd14D65B169CdB223b1921',
      logoURI: '/logos/celestia.png',
      connectedTokens: [
        'cosmos|neutron|neutron1dvzvf870mx9uf65uqhx40yzx9gu4xlqqq2pnx362a0ndmustww3smumrf5',
      ],
    },
    // TIA from Neutron on Manta
    {
      chainName: Chains.mantapacific,
      standard: TokenStandard.EvmHypSynthetic,
      name: 'TIA.n',
      symbol: 'TIA.n',
      decimals: 6,
      addressOrDenom: '0x6Fae4D9935E2fcb11fC79a64e917fb2BF14DaFaa',
      logoURI: '/logos/celestia.png',
      connectedTokens: [
        'cosmos|neutron|neutron1jyyjd3x0jhgswgm6nnctxvzla8ypx50tew3ayxxwkrjfxhvje6kqzvzudq',
      ],
    },
  ],
  options: {
    igpQuoteConstants: [
      {
        origin: Chains.neutron,
        destination: Chains.arbitrum,
        amount: 270000,
        addressOrDenom: 'utia',
      },
      {
        origin: Chains.neutron,
        destination: Chains.mantapacific,
        amount: 270000,
        addressOrDenom: 'utia',
      },
    ],
  },
};
