import { ChainMap, ChainMetadata, MultiProtocolProvider, WarpCore } from '@hyperlane-xyz/sdk';

import { getChainConfigs } from './chains';
import { getWarpCoreConfig } from './tokens';

export interface WarpContext {
  chains: ChainMap<ChainMetadata & { mailbox?: Address }>;
  multiProvider: MultiProtocolProvider<{ mailbox?: Address }>;
  warpCore: WarpCore;
}

let warpContext: WarpContext;

export function getWarpContext() {
  if (!warpContext) {
    warpContext = initWarpContext();
  }
  return warpContext;
}

export function setWarpContext(context: WarpContext) {
  warpContext = context;
}

export function initWarpContext() {
  const chains = getChainConfigs();
  const multiProvider = new MultiProtocolProvider<{ mailbox?: Address }>(chains);
  const coreConfig = getWarpCoreConfig();
  const warpCore = WarpCore.FromConfig(multiProvider, coreConfig);
  return { chains, multiProvider, warpCore };
}

export function getMultiProvider() {
  return getWarpContext().multiProvider;
}

export function getWarpCore() {
  return getWarpContext().warpCore;
}

export function getTokens() {
  return getWarpCore().tokens;
}
