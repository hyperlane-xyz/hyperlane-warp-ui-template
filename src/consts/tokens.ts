import { Chains, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenConfigs: WarpCoreConfig = {
  tokens: [
    //TODO add tokens from nexus tokens.ts and also ibc routes here
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
