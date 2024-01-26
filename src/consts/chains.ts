import { ChainMap, ChainMetadata, ExplorerFamily, chainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  // mycustomchain: {
  //   protocol: ProtocolType.Ethereum,
  //   chainId: 123123,
  //   domainId: 123123,
  //   name: 'mycustomchain',
  //   displayName: 'My Chain',
  //   nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  //   rpcUrls: [{ http: 'https://mycustomchain-rpc.com' }],
  //   blockExplorers: [
  //     {
  //       name: 'MyCustomScan',
  //       url: 'https://mycustomchain-scan.com',
  //       apiUrl: 'https://api.mycustomchain-scan.com/api',
  //       family: ExplorerFamily.Etherscan,
  //     },
  //   ],
  //   blocks: {
  //     confirmations: 1,
  //     reorgPeriod: 1,
  //     estimateBlockTime: 10,
  //   },
  //   logoURI: '/logo.svg',
  // },

  // Including configs for some Solana chains by default
  neutron: {
    ...chainMetadata.neutron,
    logoURI: '/logos/neutron.svg',
  },

  mantapacific: {
    ...chainMetadata.mantapacific,
    logoURI: '/logos/manta.svg',
  },

  celestia: {
    protocol: ProtocolType.Cosmos,
    domainId: 123456789, // TODO not a real domain id
    chainId: 'celestia',
    name: 'celestia',
    displayName: 'Celestia',
    bech32Prefix: 'celestia',
    slip44: 118,
    nativeToken: {
      name: 'Tia',
      symbol: 'TIA',
      decimals: 6,
    },
    rpcUrls: [
      { http: 'https://public-celestia-rpc.numia.xyz' },
      { http: 'https://public-celestia-lcd.numia.xyz' },
    ],
    blockExplorers: [
      {
        name: 'MintScan',
        url: 'https://www.mintscan.io/celestia',
        // TODO API not supported, using url to meet validation requirements
        apiUrl: 'https://www.mintscan.io/celestia',
        family: ExplorerFamily.Other,
      },
    ],
    logoURI: '/logos/celestia.png',
  },

  viction: {
    blockExplorers: [
      {
        family: ExplorerFamily.Other,
        name: 'Vicscan',
        url: 'https://www.vicscan.xyz',
        apiUrl: 'https://www.vicscan.xyz',
      },
    ],
    blocks: {
      confirmations: 1,
      estimateBlockTime: 2,
      reorgPeriod: 0,
    },
    chainId: 88,
    displayName: 'Viction',
    domainId: 88,
    name: 'viction',
    nativeToken: {
      decimals: 18,
      name: 'Viction',
      symbol: 'VIC',
    },
    protocol: ProtocolType.Ethereum,
    rpcUrls: [
      {
        http: 'https://viction.blockpi.network/v1/rpc/public',
      },
    ],
    logoURI: '/logos/viction.svg',
  },

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
    logoURI: '/logos/injective.svg',
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
    grpcUrls: [{ http: 'grpc-injective-ia.cosmosia.notional.ventures:443' }],
    rpcUrls: [{ http: 'https://rpc-injective-ia.cosmosia.notional.ventures' }],
    restUrls: [{ http: 'https://injective-lcd.quickapi.com:443' }],
    logoURI: '/logos/injective.svg',
  },
};
