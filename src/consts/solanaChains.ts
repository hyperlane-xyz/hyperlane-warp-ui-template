import type { Cluster } from '@solana/web3.js';

import { ChainMap, ExplorerFamily } from '@hyperlane-xyz/sdk';

import { CustomChainMetadata } from '../features/chains/types';

export const solanaChains: ChainMap<CustomChainMetadata> = {
  solanamainnet: {
    protocol: 'sealevel',
    chainId: 1399811149, // https://www.alchemy.com/chain-connect/chain/solana
    domainId: 1399811149, // TODO
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
    domainId: 13998111450, // TODO
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
    domainId: 13375, // TODO change after next deployment
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
    mailbox: '692KZJaoe2KRcD6uhCQDLLXnLNA5ZLnfvdqjE4aX9iu1',
    logoURI: '/logos/solana.svg',
  },
  // TODO remove
  solanadevnet2: {
    protocol: 'sealevel',
    chainId: 1399811152,
    domainId: 13376, // TODO change after next deployment
    name: 'solanadevnet2',
    displayName: 'Sol Devnet2',
    nativeToken: { name: 'Sol', symbol: 'SOL', decimals: 9 },
    publicRpcUrls: [{ http: 'https://api.devnet.solana.com' }],
    blockExplorers: [],
    blocks: {
      confirmations: 1,
      reorgPeriod: 1,
      estimateBlockTime: 1,
    },
    mailbox: 'AWgqPcY1vjHRoFLHNgs15fdvy4bqEakHmYXW78B8GgYk',
    logoURI: '/logos/solana.svg',
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