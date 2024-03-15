import {
  ChainMap,
  ChainMetadata,
  IToken,
  MultiProtocolProvider,
  Token,
  WarpCore,
} from '@hyperlane-xyz/sdk';
import { isNullish } from '@hyperlane-xyz/utils';

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
