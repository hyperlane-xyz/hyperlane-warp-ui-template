import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenConfigs: WarpCoreConfig = {
  tokens: [
    {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: '0x9f5cF636b4F2DC6D83c9d21c8911876C235DbC9f',
      collateralAddressOrDenom: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      connections: [
        {
          token: 'ethereum|ancient8|0xB3fCcD379ad66CED0c91028520C64226611A48c9',
        },
      ],
    },
    {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      chainName: 'ancient8',
      standard: TokenStandard.EvmHypSynthetic,
      addressOrDenom: '0xB3fCcD379ad66CED0c91028520C64226611A48c9',
      connections: [
        {
          token: 'ethereum|ethereum|0x9f5cF636b4F2DC6D83c9d21c8911876C235DbC9f',
        },
      ],
    },
  ],
  options: {},
};
