import { MultiProvider } from '@hyperlane-xyz/sdk';

import { getChainConfigs } from './chains/metadata';

let multiProvider: MultiProvider;

export function getMultiProvider() {
  if (!multiProvider) {
    multiProvider = new MultiProvider(getChainConfigs());
  }
  return multiProvider;
}

export function getProvider(chainId: ChainId) {
  return getMultiProvider().getProvider(chainId);
}
