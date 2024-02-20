import { ChainMap, ChainMetadata, ExplorerFamily } from '@hyperlane-xyz/sdk';
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
  plumetestnet: {
    blockExplorers: [
      {
        apiUrl: 'https://plume-testnet.explorer.caldera.xyz/api',
        family: ExplorerFamily.Blockscout,
        name: 'Plume Testnet Explorer',
        url: 'https://plume-testnet.explorer.caldera.xyz',
      },
    ],
    blocks: {
      confirmations: 1,
      estimateBlockTime: 3,
      reorgPeriod: 1,
    },
    chainId: 161221135,
    displayName: 'Plume Testnet',
    domainId: 161221135,
    isTestnet: true,
    name: 'plumetestnet',
    nativeToken: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
    },
    protocol: ProtocolType.Ethereum,
    rpcUrls: [{ http: 'https://plume-testnet.rpc.caldera.xyz/http' }],
  },
};
