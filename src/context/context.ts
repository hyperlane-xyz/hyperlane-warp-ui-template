import { ChainMap, ChainMetadata, MultiProtocolProvider } from '@hyperlane-xyz/sdk';

import type { RoutesMap } from '../features/routes/types';
import type { TokenMetadata } from '../features/tokens/types';

import Chains from './_chains.json';
import Routes from './_routes.json';
import Tokens from './_tokens.json';

export interface WarpContext {
  chains: ChainMap<ChainMetadata & { mailbox?: Address }>;
  tokens: TokenMetadata[];
  routes: RoutesMap;
  multiProvider: MultiProtocolProvider<{ mailbox?: Address }>;
}

let warpContext: WarpContext;

export function getWarpContext() {
  if (!warpContext) {
    warpContext = {
      chains: Chains as any,
      tokens: Tokens as any,
      routes: Routes as any,
      multiProvider: new MultiProtocolProvider<{ mailbox?: Address }>(Chains as any),
    };
  }
  return warpContext;
}

export function setWarpContext(context: WarpContext) {
  warpContext = context;
}
