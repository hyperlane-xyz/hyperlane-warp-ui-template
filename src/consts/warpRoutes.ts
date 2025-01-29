import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    {
      chainName: 'arbitrum',
      standard: TokenStandard.EvmHypCollateral,
      decimals: 18,
      symbol: 'SMOL',
      name: 'SMOL',
      addressOrDenom: '0xA4Bbac7eD5BdA8Ec71a1aF5ee84d4c5a737bD875',
      collateralAddressOrDenom: '0x9E64D3b9e8eC387a9a58CED80b71Ed815f8D82B5',
      connections: [
        {
          token: 'ethereum|treasure|0xb73e4f558F7d4436d77a18f56e4EE9d01764c641',
        },
      ],
    },
    {
      chainName: 'treasure',
      standard: TokenStandard.EvmHypNative,
      decimals: 18,
      symbol: 'SMOL',
      name: 'SMOL',
      addressOrDenom: '0xb73e4f558F7d4436d77a18f56e4EE9d01764c641',
      connections: [
        {
          token: 'ethereum|arbitrum|0xA4Bbac7eD5BdA8Ec71a1aF5ee84d4c5a737bD875',
        },
      ],
    },
    {
      chainName: 'treasure',
      standard: TokenStandard.EvmHypSynthetic,
      decimals: 18,
      symbol: 'SMOL',
      name: 'SMOL',
      addressOrDenom: '0xb73e4f558F7d4436d77a18f56e4EE9d01764c641',
      connections: [
        {
          token: 'ethereum|ethereum|0x53ccE6d10e43d1B3D11872Ad22eC2aCd8d2537B8',
        },
      ],
    },
    {
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypSynthetic,
      decimals: 18,
      symbol: 'SMOL',
      name: 'SMOL',
      addressOrDenom: '0x53ccE6d10e43d1B3D11872Ad22eC2aCd8d2537B8',
      connections: [
        {
          token: 'ethereum|treasure|0xb73e4f558F7d4436d77a18f56e4EE9d01764c641',
        },
      ],
    },
    {
      chainName: 'arbitrum',
      standard: TokenStandard.EvmHypSynthetic,
      decimals: 18,
      symbol: 'SMOL',
      name: 'SMOL',
      addressOrDenom: '0xA4Bbac7eD5BdA8Ec71a1aF5ee84d4c5a737bD875',
      connections: [
        {
          token: 'ethereum|ethereum|0x53ccE6d10e43d1B3D11872Ad22eC2aCd8d2537B8',
        },
      ],
    },
    {
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypSynthetic,
      decimals: 18,
      symbol: 'SMOL',
      name: 'SMOL',
      addressOrDenom: '0x53ccE6d10e43d1B3D11872Ad22eC2aCd8d2537B8',
      collateralAddressOrDenom: '0x9E64D3b9e8eC387a9a58CED80b71Ed815f8D82B5',
      connections: [
        {
          token: 'ethereum|arbitrum|0xA4Bbac7eD5BdA8Ec71a1aF5ee84d4c5a737bD875',
        },
      ],
    },
    // {
    //   chainName: 'arbitrumsepolia',
    //   standard: TokenStandard.EvmHypCollateral,
    //   decimals: 18,
    //   symbol: 'SMOL',
    //   name: 'SMOL',
    //   addressOrDenom: '0x608238d2F754FA7f4A717d283F135D0cE50C493F',
    //   collateralAddressOrDenom: '0x82F3f3f5cD3e28B37eFbCFa985b93E82Ea6bE2a3',
    //   connections: [
    //     {
    //       token: 'ethereum|treasuretopaz|0xab72295bc9C74DEe0A30231C486b2D4A2ae0457e',
    //     },
    //   ],
    // },
    // {
    //   chainName: 'treasuretopaz',
    //   standard: TokenStandard.EvmHypNative,
    //   decimals: 18,
    //   symbol: 'SMOL',
    //   name: 'SMOL',
    //   addressOrDenom: '0xab72295bc9C74DEe0A30231C486b2D4A2ae0457e',
    //   connections: [
    //     {
    //       token: 'ethereum|arbitrumsepolia|0x608238d2F754FA7f4A717d283F135D0cE50C493F',
    //     },
    //   ],
    // },
    // {
    //   chainName: 'treasuretopaz',
    //   standard: TokenStandard.EvmHypSynthetic,
    //   decimals: 18,
    //   symbol: 'SMOL',
    //   name: 'SMOL',
    //   addressOrDenom: '0xab72295bc9C74DEe0A30231C486b2D4A2ae0457e',
    //   connections: [
    //     {
    //       token: 'ethereum|sepolia|0x544e25bEd12f95B5C0ebf6DA6ADB71F5Bb5773E4',
    //     },
    //   ],
    // },
    // {
    //   chainName: 'sepolia',
    //   standard: TokenStandard.EvmHypSynthetic,
    //   decimals: 18,
    //   symbol: 'SMOL',
    //   name: 'SMOL',
    //   addressOrDenom: '0x544e25bEd12f95B5C0ebf6DA6ADB71F5Bb5773E4',
    //   connections: [
    //     {
    //       token: 'ethereum|treasuretopaz|0xab72295bc9C74DEe0A30231C486b2D4A2ae0457e',
    //     },
    //   ],
    // },
  ],
  options: {},
};
