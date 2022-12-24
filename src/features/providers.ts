import { chainConnectionConfigs, chainIdToMetadata } from '@hyperlane-xyz/sdk';

// This uses public RPC URLs from the SDK but can be
// changed to use other providers as needed
export function getProvider(chainId: number) {
  const chainName = chainIdToMetadata[chainId]?.name;
  if (!chainName) throw new Error(`No metadata found for chain: ${chainId}`);
  return chainConnectionConfigs[chainName].provider;
}
