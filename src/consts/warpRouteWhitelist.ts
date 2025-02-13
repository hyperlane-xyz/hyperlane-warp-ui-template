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

  // weETHs routes
  'weETHs/eclipsemainnet-ethereum',

  // ECLIP routes
  'ECLIP/arbitrum-neutron',

  // LUMIA routes
  'LUMIA/bsc-ethereum-lumiaprism',

  // USDC routes
  'USDC/ethereum-inevm',
  'USDC/ancient8-ethereum',
  'USDC/ethereum-viction',
  'USDC/eclipsemainnet-ethereum-solanamainnet',
  'USDC/appchain-base',
  'USDC/arbitrum-base-endurance',
  'USDC/ethereum-form',
  'USDC.a/artela-base',
  'USDC/ethereum-superseed',

  // USDT routes
  'USDT/ethereum-inevm',
  'USDT/ethereum-viction',
  'USDT/eclipsemainnet-ethereum-solanamainnet',
  'USDT/ethereum-form',
  'USDT/ethereum-superseed',

  // INJ routes
  'INJ/inevm-injective',

  // SOL routes
  'SOL/eclipsemainnet-solanamainnet',
  'SOL/solanamainnet-soon',

  // ezSOL routes
  'ezSOL/eclipsemainnet-solanamainnet',

  // WIF routes
  'WIF/eclipsemainnet-solanamainnet',

  // WBTC routes
  'WBTC/eclipsemainnet-ethereum',
  'WBTC/ethereum-form',

  // ORCA routes
  'ORCA/eclipsemainnet-solanamainnet',

  // uBTC routes
  'uBTC/boba-bsquared-swell',

  // kySOL
  'kySOL/eclipsemainnet-solanamainnet',

  // PNDR
  'PNDR/bsc-ethereum-lumiaprism',

  // USDC ink
  'USDC/ethereum-ink',

  // Bonk routes
  'Bonk/solanamainnet-soon',

  // TONY routes
  'TONY/base-solanamainnet',

  // TRUMP routes
  'TRUMP/arbitrum-avalanche-base-flowmainnet-form-optimism-solanamainnet-worldchain',

  // jitoSOL
  'JitoSOL/eclipsemainnet-solanamainnet',

  // rstETH routes
  'rstETH/ethereum-zircuit',

  // SMOL routes
  'SMOL/arbitrum-ethereum-solanamainnet-treasure',

  // MAGIC routes
  'MAGIC/arbitrum-treasure',

  // WETH routes
  'WETH.a/artela-base',

  // fastUSD routes
  'fastUSD/ethereum-sei',

  // cbBTC routes
  'cbBTC/ethereum-superseed',
  'cbBTC/ethereum-flowmainnet',

  // ezETH routes
  'ezETH/arbitrum-base-berachain-blast-bsc-ethereum-fraxtal-linea-mode-optimism-sei-swell-taiko-unichain-zircuit',

  // GAME routes
  'GAME/base-form',

  // AIXBT routes
  'AIXBT/base-form',

  // wstETH routes
  'wstETH/ethereum-form',

  // pzETH routes
  'pzETH/ethereum-swell-zircuit',

  // ART routes
  'ART/artela-base-solanamainnet',

  // LOGX routes
  'LOGX/arbitrum-solanamainnet',
];
