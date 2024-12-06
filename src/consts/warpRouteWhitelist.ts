// A list of warp route config IDs to be included in the app
// Warp Route IDs use format `SYMBOL/chainname1-chainname2...` where chains are ordered alphabetically
// If left null, all warp routes in the configured registry will be included
// If set to a list (including an empty list), only the specified routes will be included
export const warpRouteWhitelist: Array<string> | null = [
  // TIA routes
  'TIA.n/arbitrum-neutron',
  'TIA.n/mantapacific-neutron',
  'TIA/eclipsemainnet-stride',

  // stTIA routes
  'stTIA/eclipsemainnet-stride',

  // ETH routes
  'ETH/ethereum-viction',

  // tETH routes
  'tETH/eclipsemainnet-ethereum',

  // apxETH routes
  'apxETH/eclipsemainnet-ethereum',

  // ECLIP routes
  'ECLIP/arbitrum-neutron',

  // LUMIA routes
  'LUMIA/bsc-ethereum-lumia',

  // USDC routes
  'USDC/ethereum-inevm',
  'USDC/ancient8-ethereum',
  'USDC/ethereum-viction',
  'USDC/eclipsemainnet-ethereum-solanamainnet',

  // USDT routes
  'USDT/ethereum-inevm',
  'USDT/ethereum-viction',
  'USDT/eclipsemainnet-ethereum-solanamainnet',

  // INJ routes
  'INJ/inevm-injective',

  // SOL routes
  'SOL/eclipsemainnet-solanamainnet',

  // WIF routes
  'WIF/eclipsemainnet-solanamainnet',

  // WBTC routes
  'WBTC/eclipsemainnet-ethereum',

  // ORCA routes
  'ORCA/eclipsemainnet-solanamainnet',
];
