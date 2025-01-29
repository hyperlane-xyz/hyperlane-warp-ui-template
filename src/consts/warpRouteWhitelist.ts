// A list of warp route config IDs to be included in the app
// Warp Route IDs use format `SYMBOL/chainname1-chainname2...` where chains are ordered alphabetically
// If left null, all warp routes in the configured registry will be included
// If set to a list (including an empty list), only the specified routes will be included
export const warpRouteWhitelist: Array<string> | null = [
  'SMOL/arbitrum-treasure',
  'SMOL/ethereum-treasure',
  'SMOL/treasure-ethereum',
  // 'SMOL/arbitrumsepolia-sepolia',
  // 'SMOL/arbitrumsepolia-treasuretopaz',
  // 'SMOL/sepolia-arbitrumsepolia',
  // 'SMOL/sepolia-treasuretopaz',
  // 'SMOL/treasuretopaz-arbitrumsepolia',
  // 'SMOL/treasuretopaz-sepolia',
];
