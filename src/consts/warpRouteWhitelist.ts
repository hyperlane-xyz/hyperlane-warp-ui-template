// A list of warp route config IDs to be included in the app
// Warp Route IDs use format `SYMBOL/chainname1-chainname2...` where chains are ordered alphabetically
// If left empty, all warp routes in the configured registry will be included
export const warpRouteWhitelist: Array<string> | undefined = [
  'USDC/ethereum-inevm',
  'USDT/ethereum-inevm',
  'INJ/inevm-injective',
];
