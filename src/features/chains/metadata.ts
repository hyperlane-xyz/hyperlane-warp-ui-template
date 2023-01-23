import { ChainMetadata, chainIdToMetadata } from '@hyperlane-xyz/sdk';

import { chainIdToCustomConfig } from '../../consts/chains';

export function getChainMetadata(chainId: number): ChainMetadata {
  if (chainIdToCustomConfig[chainId]) return chainIdToCustomConfig[chainId] as ChainMetadata;
  else if (chainIdToMetadata[chainId]) return chainIdToMetadata[chainId];
  else throw new Error(`No metadata found for chain ${chainId}`);
}

export function getChainExplorerUrl(chainId: number, apiUrl = false): string {
  const metadata = getChainMetadata[chainId];
  const first = metadata.blockExplorers[0];
  return apiUrl ? first.apiUrl || first.url : first.url;
}

export function getChainDisplayName(chainId?: number, shortName = false): string {
  if (!chainId) return 'Unknown';
  const metadata = getChainMetadata[chainId];
  return shortName ? metadata.displayNameShort || metadata.displayName : metadata.displayName;
}
