import { IRegistry } from '@hyperlane-xyz/registry';
import {
  ChainMap,
  ChainMetadata,
  IToken,
  MultiProtocolProvider,
  Token,
  WarpCore,
} from '@hyperlane-xyz/sdk';
import { isNullish } from '@hyperlane-xyz/utils';

import { assembleChainMetadata } from './chains';
import { assembleWarpCoreConfig } from './warpCoreConfig';

export interface WarpContext {
  registry: IRegistry;
  chains: ChainMap<ChainMetadata>;
  multiProvider: MultiProtocolProvider;
  warpCore: WarpCore;
}

// Note: This was initially static so it was simpler to keep it out of a state store.
// Now it's somewhat dynamic based on env vars. If more flexibility is needed, it could be moved.
let warpContext: WarpContext;

export function getWarpContext() {
  return warpContext;
}

export async function initWarpContext() {
  const { registry, chains } = await assembleChainMetadata();
  const multiProvider = new MultiProtocolProvider(chains);
  const coreConfig = await assembleWarpCoreConfig();
  const warpCore = WarpCore.FromConfig(multiProvider, coreConfig);
  warpContext = { registry, chains, multiProvider, warpCore };
  return warpContext;
}

export function getMultiProvider() {
  return getWarpContext().multiProvider;
}

export function getRegistry() {
  return getWarpContext().registry;
}

export function getWarpCore() {
  return getWarpContext().warpCore;
}

export function getTokens() {
  return getWarpCore().tokens;
}

export function getTokenByIndex(tokenIndex?: number) {
  const tokens = getTokens();
  if (isNullish(tokenIndex) || tokenIndex >= tokens.length) return undefined;
  return tokens[tokenIndex];
}

export function getIndexForToken(token?: IToken): number | undefined {
  if (!token) return undefined;
  const index = getTokens().indexOf(token as Token);
  if (index >= 0) return index;
  else return undefined;
}

export function tryFindToken(chain: ChainName, addressOrDenom?: string): IToken | null {
  try {
    return getWarpCore().findToken(chain, addressOrDenom);
  } catch (error) {
    return null;
  }
}
