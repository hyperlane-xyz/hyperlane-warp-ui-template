import type { UiToken } from '../swap/tokens/types';

// Extends UiToken with optional WarpCore key for direct bridge execution fallback.
export interface CombinedToken extends UiToken {
  // WarpCore token key ("chainName-symbol-address") enabling bridge fallback execution
  // when the engine has no route. Set when the token exists in WarpCore's registry.
  warpCoreKey?: string;
}

// Which execution path will be used for the current token pair.
export type RouteMode = 'engine' | 'bridge' | 'none';
