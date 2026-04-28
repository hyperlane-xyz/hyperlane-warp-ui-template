import { warpRouteWhitelist } from '../../src/consts/warpRouteWhitelist';

// Picks known-good warp route IDs for embed ?routes= tests.
// Prefers whitelist entries on prod branches; falls back to registry routes on main.
export function resolveTestRoutes(): { primary: string; secondary: string; skip: boolean } {
  if (warpRouteWhitelist === null) {
    return { primary: 'USDC/aleo', secondary: 'ETH/aleo', skip: false };
  }
  if (warpRouteWhitelist.length === 0) {
    return { primary: '', secondary: '', skip: true };
  }
  return {
    primary: warpRouteWhitelist[0],
    secondary: warpRouteWhitelist[1] ?? warpRouteWhitelist[0],
    skip: false,
  };
}
