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
      addressOrDenom: '0x8b4192B9Ad1fCa440A5808641261e5289e6de95D',
      collateralAddressOrDenom: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      connections: [
        {
          token: 'ethereum|ancient8|0x97423A68BAe94b5De52d767a17aBCc54c157c0E5',
        },
      ],
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
    },
  ],
  options: {},
};
