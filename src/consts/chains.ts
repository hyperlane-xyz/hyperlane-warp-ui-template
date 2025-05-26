
import {
  eclipsemainnet,
  eclipsemainnetAddresses,
  solanamainnet,
  solanamainnetAddresses,
  sonicsvm,
  sonicsvmAddresses,
  soon,
  soonAddresses,
} from '@hyperlane-xyz/registry';
import { ChainMap, ChainMetadata, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { Address, ProtocolType } from '@hyperlane-xyz/utils';


// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  solanamainnet: {
    ...solanamainnet,
    // SVM chains require mailbox addresses for the token adapters
    mailbox: solanamainnetAddresses.mailbox,
  },
  eclipsemainnet: {
    ...eclipsemainnet,
    mailbox: eclipsemainnetAddresses.mailbox,
  },
  soon: {
    ...soon,
    mailbox: soonAddresses.mailbox,
  },
  sonicsvm: {
    ...sonicsvm,
    mailbox: sonicsvmAddresses.mailbox,
  },
  basesepolia: {
    protocol: ProtocolType.Ethereum,
    chainId: 84532,
    domainId: 84532,
    name: 'basesepolia',
    displayName: 'Base Sepolia',
    nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [{ http: 'https://sepolia.base.org' }],
    blockExplorers: [
      {
        name: 'BaseScan',
        url: 'https://sepolia.basescan.org',
        apiUrl: 'https://api-sepolia.basescan.org/api',
        family: ExplorerFamily.Etherscan,
      },
    ],
    blocks: {
      confirmations: 1,
      reorgPeriod: 1,
      estimateBlockTime: 2,
    },
    mailbox: '0x6966b0E55883d49BFB24539356a2f8A673E02039',
    logoURI: '/base-logo.svg',
  },
  bsctestnet: {
    protocol: ProtocolType.Ethereum,
    chainId: 97,
    domainId: 97,
    name: 'bsctestnet',
    displayName: 'BSC Testnet',
    nativeToken: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: [{ http: 'https://data-seed-prebsc-1-s1.binance.org:8545' }],
    blockExplorers: [
      {
        name: 'BscScan',
        url: 'https://testnet.bscscan.com',
        apiUrl: 'https://api-testnet.bscscan.com/api',
        family: ExplorerFamily.Etherscan,
      },
    ],
    blocks: {
      confirmations: 1,
      reorgPeriod: 9,
      estimateBlockTime: 3,
    },
    mailbox: '0xF9F6F5646F478d5ab4e20B0F910C92F1CCC9Cc6D',
    logoURI: '/bsc-logo.svg',
  },
  edgentestnet: {
    protocol: ProtocolType.Ethereum,
    chainId: 3456,
    domainId: 3456,
    name: 'edgentestnet',
    displayName: 'Edge Testnet',
    nativeToken: { name: 'EDGEN', symbol: 'EDGEN', decimals: 18 },
    rpcUrls: [{ http: 'https://testnet-rpc.layeredge.io' }],
    blockExplorers: [
      {
        name: 'EdgeExplorer',
        url: 'https://testnet-explorer.layeredge.io',
        apiUrl: 'https://api.explorer.edgenet.example.com/api',
        family: ExplorerFamily.Blockscout,
      },
    ],
    blocks: {
      confirmations: 1,
      reorgPeriod: 1,
      estimateBlockTime: 2,
    },
    mailbox: '0x038f2E7Fcbac0BBEC0D1101Ee17029C5B0b7eCFD',
    logoURI: '/edge-logo.svg',
  },
};

// rent account payment for (mostly for) SVM chains added on top of IGP,
// not exact but should be pretty close to actual payment
export const chainsRentEstimate: ChainMap<bigint> = {
  eclipsemainnet: BigInt(Math.round(0.00004019 * 10 ** 9)),
  solanamainnet: BigInt(Math.round(0.00411336 * 10 ** 9)),
  sonicsvm: BigInt(Math.round(0.00411336 * 10 ** 9)),
  soon: BigInt(Math.round(0.00000355 * 10 ** 9)),
};
