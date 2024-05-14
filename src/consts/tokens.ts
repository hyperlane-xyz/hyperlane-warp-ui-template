import { Chains, TokenConnectionType, TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenConfigs: WarpCoreConfig = {
  tokens: [
    //#region OSMOSIS
    // TIA Osmosis to Manta
    {
      chainName: 'osmosis',
      standard: TokenStandard.CwHypCollateral,
      decimals: 6,
      symbol: 'TIA',
      name: 'Celestia',
      addressOrDenom: 'osmo1h4y9xjcvs8lrx4z8ha48uq9a338w74dpl2ly3tf74fzvugp2kj4q9l0jkw',
      collateralAddressOrDenom:
        'ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877',
      connections: [{ token: 'ethereum|mantapacific|0x88410F3D8135b4D23b98dC37C4652C6969a5B1a8' }],
    },
    // milkTIA Osmosis to Manta
    {
      chainName: 'osmosis',
      standard: TokenStandard.CwHypCollateral,
      decimals: 6,
      symbol: 'milkTIA',
      name: 'Celestia',
      addressOrDenom: 'osmo17xuecsykqw2xcxwv8cau7uy4hgdwqt0u4qxflyc2yshhggpazfjs6kfqd3',
      collateralAddressOrDenom:
        'factory/osmo1f5vfcph2dvfeqcqkhetwv75fda69z7e5c2dldm3kvgj23crkv6wqcn47a0/umilkTIA',
      connections: [{ token: 'ethereum|mantapacific|0x32474653127048d9fC20000e21dEd396b47968E8' }],
    },
    // TIA on Manta from Osmosis
    {
      chainName: 'mantapacific',
      standard: TokenStandard.EvmHypSynthetic,
      decimals: 6,
      symbol: 'TIA',
      name: 'Hyperlane Bridged TIA',
      addressOrDenom: '0x88410F3D8135b4D23b98dC37C4652C6969a5B1a8',
      connections: [
        {
          token: 'cosmos|osmosis|osmo1h4y9xjcvs8lrx4z8ha48uq9a338w74dpl2ly3tf74fzvugp2kj4q9l0jkw',
        },
      ],
    },
    // milkTIA on Manta from Osmosis
    {
      chainName: 'mantapacific',
      standard: TokenStandard.EvmHypSynthetic,
      decimals: 6,
      symbol: 'milkTIA',
      name: 'Hyperlane Bridged milkTIA',
      addressOrDenom: '0x32474653127048d9fC20000e21dEd396b47968E8',
      connections: [
        {
          token: 'cosmos|osmosis|osmo17xuecsykqw2xcxwv8cau7uy4hgdwqt0u4qxflyc2yshhggpazfjs6kfqd3',
        },
      ],
    },

    //#endregion OSMOSIS
    //#region NEUTRON

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
      logoURI: '/logos/ECLIP.png',
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

    //#endregion NEUTRON
    //#region INJECTIVE

    // INJ on Injective to inEVM
    {
      chainName: Chains.injective,
      standard: TokenStandard.CwHypNative,
      name: 'Injective Coin',
      symbol: 'INJ',
      decimals: 18,
      addressOrDenom: 'inj1mv9tjvkaw7x8w8y9vds8pkfq46g2vcfkjehc6k',
      logoURI: '/logos/injective.svg',
      connections: [{ token: 'ethereum|inevm|0x26f32245fCF5Ad53159E875d5Cae62aEcf19c2d4' }],
    },

    // INJ on inEVM from Injective
    {
      chainName: Chains.inevm,
      standard: TokenStandard.EvmHypNative,
      name: 'Injective Coin',
      symbol: 'INJ',
      decimals: 18,
      addressOrDenom: '0x26f32245fCF5Ad53159E875d5Cae62aEcf19c2d4',
      logoURI: '/logos/injective.svg',
      connections: [{ token: 'cosmos|injective|inj1mv9tjvkaw7x8w8y9vds8pkfq46g2vcfkjehc6k' }],
    },

    // USDC on Ethereum to inEVM
    {
      chainName: Chains.ethereum,
      standard: TokenStandard.EvmHypCollateral,
      name: 'USDC',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0xED56728fb977b0bBdacf65bCdD5e17Bb7e84504f',
      collateralAddressOrDenom: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      logoURI: '/logos/usdc.svg',
      connections: [{ token: 'ethereum|inevm|0x8358d8291e3bedb04804975eea0fe9fe0fafb147' }],
    },

    // USDC on inEVM from Ethereum
    {
      chainName: Chains.inevm,
      standard: TokenStandard.EvmHypSynthetic,
      name: 'USDC',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0x8358d8291e3bedb04804975eea0fe9fe0fafb147',
      logoURI: '/logos/usdc.svg',
      connections: [{ token: 'ethereum|ethereum|0xED56728fb977b0bBdacf65bCdD5e17Bb7e84504f' }],
    },

    // USDT on Ethereum to inEVM
    {
      chainName: Chains.ethereum,
      standard: TokenStandard.EvmHypCollateral,
      name: 'USDT',
      symbol: 'USDT',
      decimals: 6,
      addressOrDenom: '0xab852e67bf03E74C89aF67C4BA97dd1088D3dA19',
      collateralAddressOrDenom: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      logoURI: '/logos/usdt.svg',
      connections: [{ token: 'ethereum|inevm|0x97423a68bae94b5de52d767a17abcc54c157c0e5' }],
    },

    // USDT on inEVM to Ethereum
    {
      chainName: Chains.inevm,
      standard: TokenStandard.EvmHypSynthetic,
      name: 'USDT',
      symbol: 'USDT',
      decimals: 6,
      addressOrDenom: '0x97423a68bae94b5de52d767a17abcc54c157c0e5',
      logoURI: '/logos/usdt.svg',
      connections: [{ token: 'ethereum|ethereum|0xab852e67bf03E74C89aF67C4BA97dd1088D3dA19' }],
    },

    //#endregion INJECTIVE
    //#region VICTION

    // ETH on Ethereum to Viction
    {
      chainName: Chains.ethereum,
      standard: TokenStandard.EvmHypNative,
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      addressOrDenom: '0x15b5D6B614242B118AA404528A7f3E2Ad241e4A4',
      logoURI: '/logos/weth.png',
      connections: [{ token: 'ethereum|viction|0x182e8d7c5f1b06201b102123fc7df0eaeb445a7b' }],
    },

    // ETH on Viction from Ethereum
    {
      chainName: Chains.viction,
      standard: TokenStandard.EvmHypSynthetic,
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      addressOrDenom: '0x182e8d7c5f1b06201b102123fc7df0eaeb445a7b',
      logoURI: '/logos/weth.png',
      connections: [{ token: 'ethereum|ethereum|0x15b5D6B614242B118AA404528A7f3E2Ad241e4A4' }],
    },

    // USDC on Ethereum to Viction
    {
      chainName: Chains.ethereum,
      standard: TokenStandard.EvmHypCollateral,
      name: 'USDC',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0x31Dca7762930f56D81292f85E65c9D67575804fE',
      collateralAddressOrDenom: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      logoURI: '/logos/usdc.svg',
      connections: [{ token: 'ethereum|viction|0xbda330ea8f3005c421c8088e638fbb64fa71b9e0' }],
    },

    // USDC on Viction from Ethereum
    {
      chainName: Chains.viction,
      standard: TokenStandard.EvmHypSynthetic,
      name: 'USDC',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0xbda330ea8f3005c421c8088e638fbb64fa71b9e0',
      logoURI: '/logos/usdc.svg',
      connections: [{ token: 'ethereum|ethereum|0x31Dca7762930f56D81292f85E65c9D67575804fE' }],
    },

    // USDT on Ethereum to Viction
    {
      chainName: Chains.ethereum,
      standard: TokenStandard.EvmHypCollateral,
      name: 'USDT',
      symbol: 'USDT',
      decimals: 6,
      addressOrDenom: '0x4221a16A01F61c2b38A03C52d828a7041f6AAA49',
      collateralAddressOrDenom: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      logoURI: '/logos/usdt.svg',
      connections: [{ token: 'ethereum|viction|0x48083c69f5a42c6b69abbad48ae195bd36770ee2' }],
    },

    // USDT on Viction to Ethereum
    {
      chainName: Chains.viction,
      standard: TokenStandard.EvmHypSynthetic,
      name: 'USDT',
      symbol: 'USDT',
      decimals: 6,
      addressOrDenom: '0x48083c69f5a42c6b69abbad48ae195bd36770ee2',
      logoURI: '/logos/usdt.svg',
      connections: [{ token: 'ethereum|ethereum|0x4221a16A01F61c2b38A03C52d828a7041f6AAA49' }],
    },

    //#endregion viction
    //#region ancient8

    {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x8b4192B9Ad1fCa440A5808641261e5289e6de95D',
      collateralAddressOrDenom: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      connections: [
        {
          token: 'ethereum|ancient8|0x97423A68BAe94b5De52d767a17aBCc54c157c0E5',
        },
      ],
      logoURI: '/logos/usdc.svg',
    },
    {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      chainName: 'ancient8',
      standard: TokenStandard.EvmHypSynthetic,
      addressOrDenom: '0x97423A68BAe94b5De52d767a17aBCc54c157c0E5',
      connections: [
        {
          token: 'ethereum|ethereum|0x8b4192B9Ad1fCa440A5808641261e5289e6de95D',
        },
      ],
      logoURI: '/logos/usdc.svg',
    },

    //#endregion ancient8
  ],
  options: {
    interchainFeeConstants: [
      {
        origin: 'osmosis',
        destination: Chains.mantapacific,
        amount: 840000,
        addressOrDenom: 'ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877',
      },
      {
        origin: 'osmosis',
        destination: Chains.mantapacific,
        amount: 840000,
        addressOrDenom:
          'factory/osmo1f5vfcph2dvfeqcqkhetwv75fda69z7e5c2dldm3kvgj23crkv6wqcn47a0/umilkTIA',
      },
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
      {
        origin: Chains.injective,
        destination: Chains.inevm,
        amount: '30000000000000000', // 0.03 INJ
        addressOrDenom: 'inj',
      },
    ],
    localFeeConstants: [
      {
        origin: Chains.injective,
        destination: Chains.inevm,
        amount: '1000000000000000', // 0.001 INJ
        addressOrDenom: 'inj',
      },
    ],
  },
};
