// A list of warp route config IDs to be included in the app
// Warp Route IDs use format `SYMBOL/chainname1-chainname2...` where chains are ordered alphabetically
// If left null, all warp routes in the configured registry will be included
// If set to a list (including an empty list), only the specified routes will be included
export const warpRouteWhitelist: Array<string> | null = null;
// Example:
// [
//   // 'ETH/ethereum-viction'
// ];

/**
 * Returns the effective warp route whitelist.
 * On the /embed route, the `routes` URL param overrides the static whitelist.
 */
export function getWarpRouteWhitelist(): Array<string> | null {
  if (typeof window !== 'undefined' && window.location.pathname === '/embed') {
    const params = new URLSearchParams(window.location.search);
    const routes = params.get('routes');
    if (routes) {
      return routes
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
  }
  return warpRouteWhitelist;
}
