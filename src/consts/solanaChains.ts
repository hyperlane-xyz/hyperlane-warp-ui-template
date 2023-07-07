import type { Cluster } from '@solana/web3.js';

import { ChainMap, ExplorerFamily } from '@hyperlane-xyz/sdk';

import { CustomChainMetadata } from '../features/chains/types';

// TODO move to SDK
export const solanaChains: ChainMap<CustomChainMetadata> = {
  solanamainnet: {
    protocol: 'sealevel',
    chainId: 1399811149, // https://www.alchemy.com/chain-connect/chain/solana
    domainId: 1399811149,
    name: 'solanamainnet',
    displayName: 'Solana',
    nativeToken: { name: 'Sol', symbol: 'SOL', decimals: 9 },
    publicRpcUrls: [{ http: 'https://api.mainnet-beta.solana.com' }],
    blockExplorers: [
      {
        name: 'SolScan',
        url: 'https://solscan.io',
        apiUrl: 'https://public-api.solscan.io',
        family: ExplorerFamily.Other,
      },
    ],
    blocks: {
      confirmations: 1,
      reorgPeriod: 1,
      estimateBlockTime: 1,
    },
    mailbox: 'TODO',
    logoURI: '/logos/solana.svg',
  },
  solanatestnet: {
    protocol: 'sealevel',
    chainId: 13998111450,
    domainId: 13998111450,
    name: 'solanatestnet',
    displayName: 'Sol Testnet',
    nativeToken: { name: 'Sol', symbol: 'SOL', decimals: 9 },
    publicRpcUrls: [{ http: 'https://api.testnet.solana.com' }],
    blockExplorers: [],
    blocks: {
      confirmations: 1,
      reorgPeriod: 1,
      estimateBlockTime: 1,
    },
    mailbox: 'TODO',
    logoURI: '/logos/solana.svg',
  },
  solanadevnet: {
    protocol: 'sealevel',
    chainId: 1399811151,
    domainId: 1399811151,
    name: 'solanadevnet',
    displayName: 'Sol Devnet',
    nativeToken: { name: 'Sol', symbol: 'SOL', decimals: 9 },
    publicRpcUrls: [{ http: 'https://api.devnet.solana.com' }],
    blockExplorers: [],
    blocks: {
      confirmations: 1,
      reorgPeriod: 1,
      estimateBlockTime: 1,
    },
    mailbox: '4v25Dz9RccqUrTzmfHzJMsjd1iVoNrWzeJ4o6GYuJrVn',
    logoURI: '/logos/solana.svg',
  },
  zbctestnet: {
    protocol: 'sealevel',
    chainId: 2053254516,
    domainId: 2053254516,
    name: 'zbctestnet',
    displayName: 'Zbc Testnet',
    nativeToken: { name: 'Sol', symbol: 'SOL', decimals: 9 },
    publicRpcUrls: [{ http: 'https://api.zebec.eclipsenetwork.xyz:8899' }],
    blockExplorers: [],
    blocks: {
      confirmations: 1,
      reorgPeriod: 1,
      estimateBlockTime: 1,
    },
    mailbox: '4hW22NXtJ2AXrEVbeAmxjhvxWPSNvfTfAphKXdRBZUco',
    logoURI: '/logos/zebec.png',
  },
};

// For general use in UI
export function getSolanaChainName(rpcEndpoint: string) {
  if (!rpcEndpoint) return {};
  if (rpcEndpoint?.includes('devnet')) return { name: 'solanadevnet', displayName: 'Sol Devnet' };
  if (rpcEndpoint?.includes('testnet'))
    return { name: 'solanatestnet', displayName: 'Sol Testnet' };
  return { name: 'solanamainnet', displayName: 'Solana' };
}

// For use in when interacting with solana/web3.js Connection class
export function getSolanaClusterName(chainName: string): Cluster {
  if (chainName?.includes('devnet')) return 'devnet';
  if (chainName?.includes('testnet')) return 'testnet';
  return 'mainnet-beta';
}
