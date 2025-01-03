import {
  eclipsemainnet,
  eclipsemainnetAddresses,
  solanamainnet,
  solanamainnetAddresses,
  solanatestnet,
} from '@hyperlane-xyz/registry';
import { ChainMap, ChainMetadata, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  solanamainnet: {
    ...solanamainnet,
    // SVM chains require mailbox addresses for the token adapters
    mailbox: solanamainnetAddresses.mailbox,
    // Including a convenient rpc override because the Solana public RPC does not allow browser requests from localhost
    rpcUrls: process.env.NEXT_PUBLIC_SOLANA_RPC_URL
      ? [{ http: process.env.NEXT_PUBLIC_SOLANA_RPC_URL }, ...solanamainnet.rpcUrls]
      : solanamainnet.rpcUrls,
  },
  eclipsemainnet: {
    ...eclipsemainnet,
    mailbox: eclipsemainnetAddresses.mailbox,
  },
  solanatestnet: {
    ...solanatestnet,
    displayNameShort: 'Solana Testnet',
    mailbox: '75HBBLae3ddeneJVrZeyrDfv6vb7SMC3aCpBucSXS5aR',
  },
  sonicsvmtestnet: {
    blockExplorers: [
      {
        apiUrl: 'https://explorer.sonic.game/?cluster=testnet.v1',
        family: ExplorerFamily.Other,
        name: 'Sonic Explorer',
        url: 'https://explorer.sonic.game/?cluster=testnet.v1',
      },
    ],
    blocks: {
      confirmations: 1,
      estimateBlockTime: 0.4,
      reorgPeriod: 0,
    },
    chainId: 15153042,
    deployer: {
      name: 'Abacus Works',
      url: 'https://www.hyperlane.xyz',
    },
    displayName: 'Sonic SVM Testnet',
    displayNameShort: 'Sonic SVM Testnet',
    domainId: 15153042,
    isTestnet: true,
    name: 'sonicsvmtestnet',
    nativeToken: {
      decimals: 9,
      name: 'Solana',
      symbol: 'SOL',
    },
    protocol: ProtocolType.Sealevel,
    rpcUrls: [
      {
        http: 'https://api.testnet.sonic.game',
      },
    ],
    logoURI: '/sonicsvmtestnet-logo.svg',
    mailbox: '6BaTtWPMpWdA6tHqdT2VbogC4XZ9QV5cNCYpBrx6WP7B',
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
