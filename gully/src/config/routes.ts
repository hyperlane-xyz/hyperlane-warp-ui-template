import type { Address } from 'viem';

import data from './routes.json';
import type { ChainKey } from './chains';

export interface WarpToken {
  address: Address;
  standard: string;
  tokenType: 'native' | 'synthetic' | 'collateral' | string;
  symbol: string;
  name: string;
  decimals: number;
  collateralAddress: Address | null;
}

export interface FastRoute {
  id: string;
  symbol: string;
  tokens: Record<ChainKey, WarpToken>;
  /** retired route (gETH, hypETH): never offered for deposits, only to redeem a GullyChain balance back to ETH */
  legacy?: boolean;
  /**
   * mirror route: the GullyChain-side token is a synthetic (EvmHypSynthetic) mirror minted on Gully Chain rather than the
   * native asset. These routes carry the "Powered by Gully Core" badge (brand kit v4). Written by scripts/sync-routes.mjs.
   */
  mirror?: boolean;
}

export const FAST_ROUTES = data.routes as FastRoute[];
/** True for mirror routes: the GullyChain token is minted on Gully Chain (not native). */
export const isMirrorRoute = (r: Pick<FastRoute, 'mirror'> | null | undefined): boolean => r?.mirror === true;
/** The badge's link target (brand kit v4 badges/README.md): opens in a new tab like every external link. */
export const GULLY_CORE_URL = 'https://gullychain.xyz/gully-core/';
export const DEFAULT_FAST_ROUTE_ID = data.defaultRouteId;
/** retired routes whose GullyChain token can still be redeemed (synthetic or collateral tokens a wallet can hold) */
export const LEGACY_ROUTES = FAST_ROUTES.filter((r) => r.legacy && r.tokens.gullychaintestnet.tokenType !== 'native');

/** A route for a transfer: deposits always use the default route; legacy routes are only valid to withdraw (redeem). */
export function routeFor(direction: 'deposit' | 'withdraw', id?: string): FastRoute {
  const r = fastRoute(id);
  return r.legacy && direction === 'deposit' ? fastRoute(DEFAULT_FAST_ROUTE_ID) : r;
}

export function fastRoute(id?: string): FastRoute {
  return FAST_ROUTES.find((r) => r.id === id) || FAST_ROUTES.find((r) => r.id === DEFAULT_FAST_ROUTE_ID)!;
}
