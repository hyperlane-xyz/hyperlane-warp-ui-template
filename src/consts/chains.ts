import { ChainMap, ChainMetadata, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  inevm: {
    blockExplorers: [
      {
        apiUrl: 'https://inevm.calderaexplorer.xyz/api',
        family: ExplorerFamily.Blockscout,
        name: 'Caldera inEVM Explorer',
        url: 'https://inevm.calderaexplorer.xyz',
      },
    ],
    blocks: {
      confirmations: 1,
      estimateBlockTime: 3,
      reorgPeriod: 0,
    },
    chainId: 2525,
    domainId: 2525,
    displayName: 'Injective EVM',
    displayNameShort: 'inEVM',
    name: 'inevm',
    nativeToken: {
      decimals: 18,
      name: 'Injective',
      symbol: 'INJ',
    },
    protocol: ProtocolType.Ethereum,
    rpcUrls: [{ http: 'https://inevm.calderachain.xyz/http' }],
    logoURI: '/logos/inevm.svg',
  },

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
      decimals: 18,
      name: 'Injective',
      symbol: 'INJ',
    },
    protocol: ProtocolType.Cosmos,
    slip44: 118,
    bech32Prefix: 'inj',
    grpcUrls: [{ http: 'injective-grpc.polkachu.com:14390' }],
    rpcUrls: [{ http: 'https://injective-rpc.polkachu.com' }],
    restUrls: [{ http: 'https://injective-api.polkachu.com' }],
    logoURI: '/logos/injective.svg',
  },
};
