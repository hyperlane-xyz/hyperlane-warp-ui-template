import { solanatestnet, solanatestnetAddresses } from '@hyperlane-xyz/registry';
import { ChainMap, ChainMetadata, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

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
  solanatestnet: {
    ...solanatestnet,
    mailbox: solanatestnetAddresses.mailbox,
  },
  starknetsepolia: {
    chainId: '0x534e5f5345504f4c4941',
    domainId: 23448591,
    name: 'starknetsepolia',
    protocol: ProtocolType.Starknet,
    rpcUrls: [{ http: 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7' }],
    blocks: {
      confirmations: 0,
      estimateBlockTime: 5,
      reorgPeriod: 0,
    },
    isTestnet: true,
    displayName: 'Starknet Sepolia',
    nativeToken: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      denom: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    },
    blockExplorers: [
      {
        name: 'Starknet Sepolia',
        url: 'https://sepolia.voyager.online/',
        apiUrl: 'https://sepolia.voyager.online/api',
        family: ExplorerFamily.Other,
      },
    ],
    logoURI: '/logo/starknet.svg',
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
