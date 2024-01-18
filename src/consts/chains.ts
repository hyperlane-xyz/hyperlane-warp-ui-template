import { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  injective: {
    blockExplorers: [],
    blocks: {
      confirmations: 1,
      estimateBlockTime: 3,
      reorgPeriod: 1,
    },
    chainId: 'injective-1',
    domainId: 6909546,
    displayName: 'Injective',
    displayNameShort: 'Injective',
    name: 'injective',
    nativeToken: {
      decimals: 6,
      name: 'Injective',
      symbol: 'INJ',
    },
    protocol: ProtocolType.Cosmos,
    bech32Prefix: 'inj',
    slip44: 118,
    rpcUrls: [{ http: 'https://sentry.tm.injective.network:443' }],
    restUrls: [{ http: 'https://sentry.lcd.injective.network:443' }],
  },
};
