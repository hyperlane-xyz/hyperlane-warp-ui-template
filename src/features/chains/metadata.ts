import type { Chain as WagmiChain } from '@wagmi/core';

import {
  ChainMetadata,
  chainIdToMetadata,
  chainMetadataToWagmiChain,
  objMap,
} from '@hyperlane-xyz/sdk';

import CustomChainConfig from '../../consts/chains.json';

export type CustomChainMetadata = ChainMetadata & {
  logoImgSrc: string;
};

export const chainIdToCustomConfig = Object.values(CustomChainConfig).reduce<
  Record<number, CustomChainMetadata>
>((result, config) => {
  result[config.chainId] = config as CustomChainMetadata;
  return result;
}, {});

// TODO use MultiProvider here
export function getChainMetadata(chainId: number): ChainMetadata {
  if (chainIdToCustomConfig[chainId]) return chainIdToCustomConfig[chainId];
  else if (chainIdToMetadata[chainId]) return chainIdToMetadata[chainId];
  else throw new Error(`No metadata found for chain ${chainId}`);
}

// TODO use MultiProvider here
export function getChainRpcUrl(chainId: number): string {
  const metadata = getChainMetadata(chainId);
  const first = metadata.publicRpcUrls[0];
  return first.http;
}

// TODO use MultiProvider here
export function getChainExplorerUrl(chainId: number, apiUrl = false): string | null {
  const metadata = getChainMetadata(chainId);
  const first = metadata.blockExplorers?.[0];
  if (!first) return null;
  return apiUrl ? first.apiUrl || first.url : first.url;
}

// TODO use MultiProvider here
export function getChainDisplayName(chainId?: number, shortName = false): string {
  if (!chainId) return 'Unknown';
  const metadata = getChainMetadata(chainId);
  const displayName = shortName
    ? metadata.displayNameShort || metadata.displayName
    : metadata.displayName;
  return displayName || metadata.name;
}

// Metadata formatted for use in Wagmi config
export function getWagmiChainConfig(): WagmiChain[] {
  return Object.values({
    ...objMap(chainIdToMetadata, (_: any, m: ChainMetadata) => chainMetadataToWagmiChain(m)),
    ...objMap(chainIdToCustomConfig, (_: any, m: ChainMetadata) => chainMetadataToWagmiChain(m)),
  });
}
