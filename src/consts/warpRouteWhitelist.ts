// A list of warp route config IDs to be included in the app
// Warp Route IDs use format `SYMBOL/chainname1-chainname2...` where chains are ordered alphabetically
// If left null, all warp routes in the configured registry will be included
// If set to a list (including an empty list), only the specified routes will be included
export const warpRouteWhitelist: Array<string> | null = [
  // TIA routes
  'TIA/arbitrum-neutron',
  'TIA/mantapacific-neutron',
  'TIA/eclipsemainnet-stride',

  // stTIA routes
  'stTIA/eclipsemainnet-stride',

  // ETH routes
  'ETH/ethereum-hyperevm',
  'ETH/ethereum-viction',
  'ETH/arbitrum-base-ethereum-lumiaprism-optimism-polygon',
  'ETH/coti-ethereum',

  // tETH routes
  'tETH/eclipsemainnet-ethereum',

  // apxETH routes
  'apxETH/eclipsemainnet-ethereum',

  // weETHs routes
  'weETHs/eclipsemainnet-ethereum',

  // ECLIP routes
  'ECLIP/arbitrum-neutron',

  // LUMIA routes
  'LUMIA/arbitrum-avalanche-base-bsc-ethereum-lumiaprism-optimism-polygon',

  // USDC routes
  'USDC/ethereum-inevm',
  'USDC/ancient8-ethereum',
  'USDC/ethereum-viction',
  'USDC/eclipsemainnet-ethereum-solanamainnet',
  'USDC/appchain-base',
  'USDC/arbitrum-base-endurance',
  'USDC/ethereum-form',
  'USDC/artela-base',
  'USDC/solanamainnet-sonicsvm',
  'USDC/arbitrum-base-ethereum-ink-optimism-solanamainnet-superseed',
  'USDC/subtensor',
  'USDC/lumia',
  'USDC/matchain',

  // USDT routes
  'USDT/eclipsemainnet-ethereum-solanamainnet',
  'USDT/ethereum-form',
  'USDT/ethereum-hyperevm',
  'USDT/ethereum-inevm',
  'USDT/ethereum-lumiaprism',
  'USDT/ethereum-viction',
  'USDT/matchain',
  'USDT/solanamainnet-sonicsvm',

  // oUSDT routes
  'oUSDT/production',

  // oXAUT routes
  'oXAUT/production',

  // INJ routes
  'INJ/inevm-injective',

  // SOL routes
  'SOL/eclipsemainnet-solanamainnet',
  'SOL/solanamainnet-soon',
  'SOL/hyperevm-solanamainnet',
  'SOL/solanamainnet-sonicsvm',

  // ezSOL routes
  'ezSOL/eclipsemainnet-solanamainnet',

  // WIF routes
  'WIF/eclipsemainnet-solanamainnet',

  // WBTC routes
  'WBTC/eclipsemainnet-ethereum',
  'WBTC/ethereum-form',
  'WBTC/ethereum-hyperevm',
  'WBTC/coti-ethereum',

  // ORCA routes
  'ORCA/eclipsemainnet-solanamainnet',

  // uBTC routes
  'uBTC/bsquared',

  // kySOL
  'kySOL/kyros',

  // PNDR
  'PNDR/bsc-ethereum-lumiaprism',

  // USDC ink
  'USDC/ethereum-ink',

  // Bonk routes
  'Bonk/solanamainnet-soon',

  // TGT routes
  'TGT/bsc-immutablezkevmmainnet',

  // TONY routes
  'TONY/base-solanamainnet',

  // TRUMP routes
  'TRUMP/arbitrum-avalanche-base-flowmainnet-form-optimism-solanamainnet-worldchain',

  // TURTLE routes
  'TURTLE/ethereum-linea',

  // jitoSOL
  'JitoSOL/eclipsemainnet-solanamainnet',

  // rstETH routes
  'rstETH/ethereum-zircuit',

  // WETH routes
  'WETH/artela-base',

  // fastUSD routes
  'fastUSD/ethereum-sei',

  // cbBTC routes
  'cbBTC/base-ethereum-superseed',
  'cbBTC/ethereum-flowmainnet',

  // ezETH routes
  'ezETH/renzo-prod',

  // GAME routes
  'GAME/base-form',

  // AIXBT routes
  'AIXBT/base-form',

  // wstETH routes
  'wstETH/ethereum-form',

  // pzETH routes
  'pzETH/berachain-ethereum-swell-unichain-zircuit',

  // pumpBTCuni routes
  'pumpBTCuni/ethereum-unichain',

  // ART routes
  'ART/artela-base-solanamainnet',

  // LOGX routes
  'LOGX/arbitrum-solanamainnet',

  // CDX routes
  'CDX/base-solanamainnet-sophon',

  // Mint routes
  'MINT/mint-solanamainnet',

  // lrtsSOL routes
  'lrtsSOL/solanamainnet-sonicsvm',

  // sSOL routes
  'sSOL/solanamainnet-sonicsvm',

  // sonicSOL routes
  'sonicSOL/solanamainnet-sonicsvm',

  // SONIC routes
  'SONIC/solanamainnet-sonicsvm',

  // SPICE routes
  'SPICE/solanamainnet-sonicsvm',

  // REZ routes
  'REZ/base-ethereum-unichain',

  // enzoBTC routes
  'enzoBTC/bsc-hyperevm',

  // stBTC routes
  'stBTC/bsc-hyperevm',

  // GPS routes
  'GPS/base-bsc',

  // SOON batch
  'ai16z/solanamainnet-soon',
  'ELIZA/solanamainnet-soon',
  'MEW/solanamainnet-soon',
  'Pnut/solanamainnet-soon',
  'WIF/solanamainnet-soon',
  'POPCAT/solanamainnet-soon',
  'GIGA/solanamainnet-soon',
  'GOAT/solanamainnet-soon',
  'SPORE/solanamainnet-soon',

  // COTI routes
  'USDC/coti-ethereum',

  // SUPR routes
  'SUPR/base-ethereum-ink-optimism-superseed',

  // HYPER routes
  'HYPER/arbitrum-base-bsc-ethereum-optimism',
  'stHYPER/bsc-ethereum',

  // MILK route
  'MILK/bsc-milkyway',

  // Fragmetric routes
  'wfragSOL/fragmetric',
  'wfragJTO/fragmetric',
  'wfragBTC/fragmetric',

  // ES routes
  'ES/eclipse',

  // apechain batch
  'PEPE/apechain-arbitrum',
  'GG/apechain-arbitrum',
  'Boop/apechain-arbitrum',

  // apechain solana batch
  'SOL/apechain-solanamainnet',
  'PENGU/apechain-solanamainnet',
  'Fartcoin/apechain-solanamainnet',
  'UFD/apechain-solanamainnet',

  // MIRAI
  'MIRAI/abstract-bsc-solanamainnet',

  // Nucleus tUSD routes
  'tUSD/eclipsemainnet-ethereum',

  // FUEL
  'FUEL/base-bsc-ethereum',

  // KYVE
  'KYVE/base-kyve',

  // RDO routes
  'RDO/bsc-ethereum',

  // CHILL routes
  'CHILL/solanamainnet-sonicsvm',

  // SMOL route
  'SMOL/arbitrum-abstract-ethereum-solanamainnet',

  // MAGIC route
  'MAGIC/arbitrum-abstract-ronin',

  // bbSOL
  'bbSOL/solanamainnet-soon',

  // adraSOL
  'adraSOL/solanamainnet-sonicsvm',

  // TAIKO
  'TAIKO/taiko',

  // MAT
  'MAT/matchain',

  // TOSHI
  'TOSHI/toshi',

  // SOLX
  'SOLX/nitro',

  // fluence routes
  'FLT/fluence',
  'wpFLT/fluence',

  // H
  'H/humanity',

  // RCADE route
  'RCADE/arbitrum-bsc',

  // Starknet Batch
  'dreams/solanamainnet-starknet',
  'SOL/solanamainnet-starknet',
  'Fartcoin/solanamainnet-starknet',
  'JUP/starknet',
  'Bonk/starknet',
  'Trump/starknet',

  // SEDA
  'SEDA/base-ethereum',

  // VRA route
  'VRA/bsc-ethereum',

  // PUMP routes
  'PUMP/eclipsemainnet',
  'PUMP/starknet',

  // LYX route
  'LYX/lukso',
];
