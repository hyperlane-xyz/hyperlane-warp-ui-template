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
        {
          token: 'ethereum|ethereum|0x53ccE6d10e43d1B3D11872Ad22eC2aCd8d2537B8',
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
        {
          token: 'ethereum|arbitrum|0xA4Bbac7eD5BdA8Ec71a1aF5ee84d4c5a737bD875',
        },
      ],
    },
  ],
  options: {},
};
