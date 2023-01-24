import { providers } from 'ethers';

import { getChainRpcUrl } from './chains/metadata';

const providerCache = {};

// This uses public RPC URLs from the chain configs in the SDK and/or custom settings
// Can be freely changed to use other providers/urls as needed
export function getProvider(chainId: number) {
  if (providerCache[chainId]) return providerCache[chainId];
  const rpcUrl = getChainRpcUrl(chainId);
  const provider = new providers.JsonRpcProvider(rpcUrl, chainId);
  providerCache[chainId] = provider;
  return provider;
}
