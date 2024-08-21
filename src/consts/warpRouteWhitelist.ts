// A list of warp route config IDs to be included in the app
// Warp Route IDs use format `SYMBOL/chainname1-chainname2...` where chains are ordered alphabetically
// If left null, all warp routes in the configured registry will be included
// If set to a list (including an empty list), only the specified routes will be included
export const warpRouteWhitelist: Array<string> | null = [
  // TIA routes
  // 'TIA.n/arbitrum-neutron',
  // 'TIA.n/mantapacific-neutron',

  // ETH routes
  'ETH/ethereum-viction',

  // ECLIP routes
  // 'ECLIP/arbitrum-neutron',

  // USDC routes
  'USDC/ethereum-inevm',
  'USDC/ancient8-ethereum',
  'USDC/ethereum-viction',

  // USDT routes
  'USDT/ethereum-inevm',
  'USDT/ethereum-viction',

  // INJ routes
  'INJ/inevm-injective',
];
