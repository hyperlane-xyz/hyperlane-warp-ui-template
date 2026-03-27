// A list of warp route config IDs to be included in the app
// Warp Route IDs use format `SYMBOL/chainname1-chainname2...` where chains are ordered alphabetically
// If left null, all warp routes in the configured registry will be included
// If set to a list (including an empty list), only the specified routes will be included
export const warpRouteWhitelist: Array<string> | null = ['CROSS/crosscollateral'];
// Example:
// [
//   // 'ETH/ethereum-viction'
// ];

/**
 * Returns the effective warp route whitelist.
 * On the /embed route, the `routes` URL param can filter routes.
 * If a static whitelist exists, URL routes are intersected with it
 * (only routes in BOTH are shown). If static whitelist is null,
 * URL routes are used as-is.
 */
export function getWarpRouteWhitelist(): Array<string> | null {
  if (typeof window !== 'undefined' && window.location.pathname === '/embed') {
    const params = new URLSearchParams(window.location.search);
    const routes = params.get('routes');
    if (routes) {
      const urlRoutes = routes
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      // Intersect with static whitelist if it exists
      if (warpRouteWhitelist) {
        return urlRoutes.filter((r) => warpRouteWhitelist.includes(r));
      }
      return urlRoutes;
    }
  }
  return warpRouteWhitelist;
}
