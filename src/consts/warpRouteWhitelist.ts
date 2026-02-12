// A list of warp route config IDs to be included in the app
// Warp Route IDs use format `SYMBOL/chainname1-chainname2...` where chains are ordered alphabetically
// If left null, all warp routes in the configured registry will be included
// If set to a list (including an empty list), only the specified routes will be included
export const warpRouteWhitelist: Array<string> | null = [
  // TIA routes
  'TIA/eclipsemainnet-stride',

  // TIA routes (cosmos-sdk)
  'TIA/abstract-celestia',
  'TIA/arbitrum',
  'TIA/base-celestia',
  'TIA/celestia-ethereum',
  'TIA/celestia-solanamainnet',
  'TIA/celestia-eclipsemainnet',

  // stTIA routes
  'stTIA/eclipsemainnet-stride',

  // ETH routes
  'ETH/ethereum-hyperevm',
  'ETH/arbitrum-base-ethereum-lumiaprism-optimism-polygon',
  'ETH/coti-ethereum',
  'ETH/paradex',

  // tETH routes
  'tETH/eclipsemainnet-ethereum',

  // apxETH routes
  'apxETH/eclipsemainnet-ethereum',

  // weETHs routes
  'weETHs/eclipsemainnet-ethereum',

  // ECLIP routes
  'ECLIP/arbitrum-neutron',

  // USDC routes
  'USDC/ethereum-inevm',
  'USDC/ancient8-ethereum',
  'USDC/ethereum-viction',
  'USDC/appchain-base',
  'USDC/arbitrum-base-endurance',
  'USDC/artela-base',
  'USDC/solanamainnet-sonicsvm',
  'USDC/superseed',
  'USDC/subtensor',
  'USDC/lumia',
  'USDC/matchain',
  'USDC/paradex',

  // USDT routes
  'USDT/eclipsemainnet-ethereum-solanamainnet',
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
  // 'cbBTC/ethereum-flowmainnet',

  // ezETH routes
  'ezETH/renzo-prod',

  // pzETH routes
  'pzETH/berachain-ethereum-swell-unichain-zircuit',

  // pumpBTCuni routes
  'pumpBTCuni/ethereum-unichain',

  // pumpBTCstk routes
  'pumpBTCstk/starknet',

  // ART routes
  'ART/artela-base-solanamainnet',

  // LOGX routes
  'LOGX/arbitrum-solanamainnet',

  // CDX routes
  'CDX/base-solanamainnet-sophon',

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

  'POG/apechain',

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
  'SMOL/arbitrum-abstract-ethereum-solanamainnet-base',

  // MAGIC route
  'MAGIC/arbitrum-abstract-ronin-base',

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

  // Solaxy routes
  'SOLX/nitro',
  'USDC/solaxy',

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

  // MONEY
  'MONEY/sonicsvm',

  // INVT route
  'INVT/solanamainnet-eclipsemainnet',

  // MITO route
  'MITO/mitosis',

  // KING route
  'KING/coti-ethereum',

  // HOLO route
  'HOLO/bsc-solanamainnet',

  // Radix batch
  'USDC/radix',
  'USDT/ethereum-radix',
  'ETH/ethereum-radix',
  'WBTC/ethereum-radix',
  'SOL/radix',
  'BNB/radix',

  'XRD/radix',

  // Pulsechain routes
  'USDC/pulsechain',

  // Electroneum routes
  'USDC/electroneum',
  'USDT/electroneum',
  'ETN/electroneum',

  // Galactica routes
  'GNET/galactica',

  // Carrchain routes
  'CARR/carrchain',

  // Mantra routes
  'USDC/mantra',
  'USDT/mantra',
  'ETH/mantra',
  'HYPE/mantra',
  'WBTC/mantra',

  // Incentiv routes
  'CENT/incentiv',
  'WETH/incentiv',
  'WBTC/incentiv',
  'USDC/incentiv',
  'USDT/incentiv',
  'SOL/incentiv',

  // Litchain
  'LITKEY/litchain',

  // M0 routes
  'mUSD/musd',

  'USDSC/usdsc',
  'wM/wrapped-m',

  'BEST/ethereum',

  // Lazai routes
  'METIS/lazai',

  // Carrchain routes
  'USDC/carrchain',
  'USDT/carrchain',
  'WBTC/carrchain',
  'WETH/carrchain',

  // Krown routes
  'ETH/krown',
  'USDC/krown',
  'USDT/krown',
  'BNB/krown',
  'WBTC/krown',
  'KROWN/krown',

  // ENI routes
  'ETH/eni',
  'USDC/eni',
  'USDT/eni',
  'WBTC/eni',
  'ROAM/eni',

  // First Party Warp Routes
  'USDC/eclipsemainnet',

  // Aleo warp routes
  'ALEO/aleo',
  'ETH/aleo',
  'USDC/aleo',
  'USDT/aleo',
  'USAD/aleo',
  'SOL/aleo',
  'WBTC/aleo',
];
