// A list of warp route config IDs to be included in the app
// Warp Route IDs use format `SYMBOL/chainname1-chainname2...` where chains are ordered alphabetically
// If left null, all warp routes in the configured registry will be included
// If set to a list (including an empty list), only the specified routes will be included
export const warpRouteWhitelist: Array<string> | null = null;
// Example:
// [
//   // 'ETH/ethereum-viction'
// ];

// A list of warp route config IDs to be excluded from the app
// Routes matching any of these patterns (case-insensitive) will be filtered out
// This is applied after the whitelist filter
export const warpRouteBlacklist: Array<string> = [
  'form', // Exclude all Form chain routes
];
