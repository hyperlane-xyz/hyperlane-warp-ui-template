import { Chains, TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenConfigs: WarpCoreConfig = {
  tokens: [
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
  ],
  options: {
    interchainFeeConstants: [
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
