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
  paradexsepolia: {
    chainId: '0x505249564154455f534e5f504f54435f5345504f4c4941',
    domainId: 12263410,
    name: 'paradexsepolia',
    protocol: ProtocolType.Starknet,
    rpcUrls: [{ http: 'https://pathfinder.api.testnet.paradex.trade/rpc/v0_7' }],
    blocks: {
      confirmations: 0,
      estimateBlockTime: 4,
      reorgPeriod: 0,
    },
    isTestnet: true,
    displayName: 'Paradex Sepolia',
    nativeToken: {
      name: 'EtherDUMMY_TOKEN',
      symbol: 'DT',
      decimals: 18,
      denom: '0x49D36570D4E46F48E99674BD3FCC84644DDD6B96F7C741B1562B82F9E004DC7',
    },
    blockExplorers: [
      {
        name: 'Paradex Sepolia',
        url: 'https://voyager.testnet.paradex.trade',
        apiUrl: 'https://voyager.testnet.paradex.trade/api',
        family: ExplorerFamily.Other,
      },
    ],
    logoURI: '/logo/paradex.svg',
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
