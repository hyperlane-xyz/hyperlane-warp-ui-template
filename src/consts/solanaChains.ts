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
    logoURI: '/logos/solana.svg',
  },
  solanatestnet: {
    protocol: 'sealevel',
    chainId: 13998111450,
    domainId: 13998111450, // TODO
    name: 'solanatestnet',
    displayName: 'Sol Devnet',
    nativeToken: { name: 'Sol', symbol: 'SOL', decimals: 9 },
    publicRpcUrls: [{ http: 'https://api.testnet.solana.com' }],
    blockExplorers: [],
    blocks: {
      confirmations: 1,
      reorgPeriod: 1,
      estimateBlockTime: 1,
    },
    logoURI: '/logos/solana.svg',
  },
  solanadevnet: {
    protocol: 'sealevel',
    chainId: 1399811151,
    domainId: 1399811151, // TODO
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
    logoURI: '/logos/solana.svg',
  },
};

export function getSolanaChainName(rpcEndpoint: string) {
  if (!rpcEndpoint) return {};
  if (rpcEndpoint?.includes('devnet')) return { name: 'solanadevnet', displayName: 'Sol Devnet' };
  if (rpcEndpoint?.includes('testnet'))
    return { name: 'solanatestnet', displayName: 'Sol Testnet' };
  return { name: 'solanamainnet', displayName: 'Solana' };
}
