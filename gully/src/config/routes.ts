import type { Address } from 'viem';

import testnetData from './routes.json';
import mainnetJson from './mainnet.json';
import type { ChainKey } from './chains';
import { IS_TESTNET, MAINNET, ZERO_ADDRESS, fastReady } from './network';
import type { MirrorMeta } from './mirrors';

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
  /** false on mainnet until the route's routers are configured (mainnet.json / VITE_MAINNET_*); unset = ready */
  ready?: boolean;
  /**
   * a Gully Warp Mirror route (a Gully Core coin locked on Gully Chain and its opt-in copy on another chain), loaded at
   * startup from /mirrors.json (mirrors.ts). Separate from `mirror` above, which marks the static synthetic ETH routes.
   */
  warp?: MirrorMeta;
}

/**
 * Mainnet routes from mainnet.json: router addresses come from VITE_MAINNET_FAST_*_ROUTER or the json (null until the
 * warp route is deployed). Until then the route is listed (so the card renders) but not ready, so it is never offered.
 */
function mainnetRoutes(): { defaultRouteId: string; routes: FastRoute[] } {
  const ready = fastReady(MAINNET);
  return {
    defaultRouteId: mainnetJson.defaultRouteId,
    routes: mainnetJson.routes.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      ready: r.id === mainnetJson.defaultRouteId && ready,
      tokens: {
        arbitrumsepolia: { ...r.tokens.arbitrumsepolia, address: (r.id === mainnetJson.defaultRouteId && MAINNET.fastParentRouter) || ZERO_ADDRESS },
        gullychaintestnet: { ...r.tokens.gullychaintestnet, address: (r.id === mainnetJson.defaultRouteId && MAINNET.fastChildRouter) || ZERO_ADDRESS },
      },
    })) as FastRoute[],
  };
}

const data = IS_TESTNET ? (testnetData as unknown as { defaultRouteId: string; routes: FastRoute[] }) : mainnetRoutes();

/** Every route of this network, ready or not (the card always has a route to render). */
export const ROUTE_TABLE = data.routes;
/** A route the bridge may use: every testnet route; on mainnet only once its contracts are configured. */
export const routeReady = (r: Pick<FastRoute, 'ready'>): boolean => r.ready !== false;
/** Usable routes only: the static ETH routes for stats, activity and the Fast lane. Empty on mainnet until launch day. */
export const FAST_ROUTES = ROUTE_TABLE.filter(routeReady);
/** True for mirror routes: the GullyChain token is minted on Gully Chain (not native). */
export const isMirrorRoute = (r: Pick<FastRoute, 'mirror'> | null | undefined): boolean => r?.mirror === true;
/** The badge's link target (brand kit v4 badges/README.md): opens in a new tab like every external link. */
export const GULLY_CORE_URL = 'https://gullychain.xyz/gully-core/';
export const DEFAULT_FAST_ROUTE_ID = data.defaultRouteId;
/** retired routes whose GullyChain token can still be redeemed (synthetic or collateral tokens a wallet can hold) */
export const LEGACY_ROUTES = FAST_ROUTES.filter((r) => r.legacy && r.tokens.gullychaintestnet.tokenType !== 'native');

/** Gully Warp Mirror routes, filled once at startup (boot.tsx -> setMirrorRoutes); empty when /mirrors.json is absent. */
export const MIRROR_ROUTES: FastRoute[] = [];
export function setMirrorRoutes(routes: FastRoute[]) {
  MIRROR_ROUTES.splice(0, MIRROR_ROUTES.length, ...routes.filter((r) => r.warp));
}

/** A route for a transfer: deposits always use the default route; legacy routes are only valid to withdraw (redeem). */
export function routeFor(direction: 'deposit' | 'withdraw', id?: string): FastRoute {
  const r = fastRoute(id);
  return r.legacy && direction === 'deposit' ? fastRoute(DEFAULT_FAST_ROUTE_ID) : r;
}

export function fastRoute(id?: string): FastRoute {
  return (
    ROUTE_TABLE.find((r) => r.id === id) ||
    MIRROR_ROUTES.find((r) => r.id === id) ||
    ROUTE_TABLE.find((r) => r.id === DEFAULT_FAST_ROUTE_ID)!
  );
}
