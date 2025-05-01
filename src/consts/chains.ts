import { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';
import starknetsepolia from './chains.yaml';

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  // solanamainnet: {
  //   ...solanamainnet,
  //   // SVM chains require mailbox addresses for the token adapters
  //   mailbox: solanamainnetAddresses.mailbox,
  // },
  // eclipsemainnet: {
  //   ...eclipsemainnet,
  //   mailbox: eclipsemainnetAddresses.mailbox,
  // },
  // soon: {
  //   ...soon,
  //   mailbox: soonAddresses.mailbox,
  // },
  // sonicsvm: {
  //   ...sonicsvm,
  //   mailbox: sonicsvmAddresses.mailbox,
  // },
  starknetsepolia: {
    ...starknetsepolia,
    logoURI: '/logo/starknet.svg',
    mailbox: '0x03c725cd6a4463e4a9258d29304bcca5e4f1bbccab078ffd69784f5193a6d792',
  },
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
};
