import { Chain, allChains as allChainsWagmi, chain } from 'wagmi';

export const alfajoresChain: Chain = {
  id: 44787,
  name: 'Alfajores',
  network: 'alfajores',
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: 'https://alfajores-forno.celo-testnet.org',
  },
  blockExplorers: {
    etherscan: { name: 'CeloScan', url: 'https://alfajores.celoscan.io' },
    blockscout: {
      name: 'Blockscout',
      url: 'https://explorer.celo.org/alfajores',
    },
    default: { name: 'CeloScan', url: 'https://alfajores.celoscan.io' },
  },
  testnet: true,
};

// Override to set name to just Arbitrum
const arbitrumChain = {
  ...chain.arbitrum,
  name: 'Arbitrum',
};

export const auroraTestnetChain: Chain = {
  id: 1313161555,
  name: 'Aurora',
  network: 'auroraTestnet',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: 'https://testnet.aurora.dev',
  },
  blockExplorers: {
    etherscan: {
      name: 'AuroraScan',
      url: 'https://testnet.aurorascan.dev',
    },
    default: {
      name: 'AuroraScan',
      url: 'https://testnet.aurorascan.dev',
    },
  },
  testnet: true,
};

export const avalancheChain: Chain = {
  id: 43114,
  name: 'Avalanche',
  network: 'avalanche',
  nativeCurrency: {
    decimals: 18,
    name: 'Avalanche',
    symbol: 'AVAX',
  },
  rpcUrls: {
    default: 'https://api.avax.network/ext/bc/C/rpc',
  },
  blockExplorers: {
    default: { name: 'SnowTrace', url: 'https://snowtrace.io' },
  },
  testnet: false,
};

export const bscChain: Chain = {
  id: 56,
  name: 'Binance Smart Chain',
  network: 'bsc',
  nativeCurrency: {
    decimals: 18,
    name: 'BNB',
    symbol: 'BNB',
  },
  rpcUrls: {
    default: 'https://bsc-dataseed.binance.org',
  },
  blockExplorers: {
    etherscan: { name: 'BscScan', url: 'https://bscscan.com' },
    default: { name: 'BscScan', url: 'https://bscscan.com' },
  },
  testnet: false,
};

export const bscTestnetChain: Chain = {
  id: 97,
  name: 'Bsc Testnet',
  network: 'bscTestnet',
  nativeCurrency: {
    decimals: 18,
    name: 'BNB',
    symbol: 'BNB',
  },
  rpcUrls: {
    default: 'https://data-seed-prebsc-1-s3.binance.org:8545',
  },
  blockExplorers: {
    etherscan: { name: 'BscScan', url: 'https://testnet.bscscan.com' },
    default: { name: 'BscScan', url: 'https://testnet.bscscan.com' },
  },
  testnet: true,
};

export const celoMainnetChain: Chain = {
  id: 42220,
  name: 'Celo',
  network: 'celo',
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: 'https://forno.celo.org',
  },
  blockExplorers: {
    etherscan: { name: 'CeloScan', url: 'https://celoscan.io' },
    blockscout: {
      name: 'Blockscout',
      url: 'https://explorer.celo.org',
    },
    default: { name: 'CeloScan', url: 'https://celoscan.io' },
  },
  testnet: false,
};

export const fujiTestnetChain: Chain = {
  id: 43113,
  name: 'Fuji',
  network: 'fuji',
  nativeCurrency: {
    decimals: 18,
    name: 'Avalanche',
    symbol: 'AVAX',
  },
  rpcUrls: {
    default: 'https://api.avax-test.network/ext/bc/C/rpc',
  },
  blockExplorers: {
    default: {
      name: 'Snowtrace',
      url: 'https://testnet.snowtrace.io',
    },
  },
  testnet: true,
};

export const moonbaseAlphaChain: Chain = {
  id: 1287,
  name: 'Moonbase Alpha',
  network: 'moonbaseAlpha',
  nativeCurrency: {
    decimals: 18,
    name: 'DEV',
    symbol: 'DEV',
  },
  rpcUrls: {
    default: 'https://rpc.api.moonbase.moonbeam.network',
  },
  blockExplorers: {
    etherscan: {
      name: 'MoonScan',
      url: 'https://moonbase.moonscan.io',
    },
    default: {
      name: 'MoonScan',
      url: 'https://moonbase.moonscan.io',
    },
  },
  testnet: true,
};

export const moonbeamChain: Chain = {
  id: 1284,
  name: 'Moonbeam',
  network: 'moonbeam',
  nativeCurrency: {
    decimals: 18,
    name: 'GLMR',
    symbol: 'GLMR',
  },
  rpcUrls: {
    default: 'https://rpc.api.moonbeam.network',
  },
  blockExplorers: {
    etherscan: {
      name: 'MoonScan',
      url: 'https://moonscan.io',
    },
    default: {
      name: 'MoonScan',
      url: 'https://moonscan.io',
    },
  },
  testnet: false,
};

// Override to set name to just Mumbai
const polygonMumbaiChain = {
  ...chain.polygonMumbai,
  name: 'Mumbai',
};

export const zksync2testnetChain: Chain = {
  id: 280,
  name: 'ZkSync Testnet',
  network: 'zksync2testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: 'https://zksync2-testnet.zksync.dev',
  },
  blockExplorers: {
    etherscan: {
      name: 'ZkScan',
      url: 'https://zksync2-testnet.zkscan.io',
    },
    default: {
      name: 'ZkScan',
      url: 'https://zksync2-testnet.zkscan.io',
    },
  },
  testnet: true,
};

// SDK uses name, wagmi uses ID, so this maps id to name
// Would be nice to use wagmi's chain 'name' or 'network' prop
// But doesn't match SDK
export const chainIdToName = {
  44787: 'alfajores',
  42161: 'arbitrum',
  421611: 'arbitrumrinkeby',
  421613: 'arbitrumgoerli',
  1313161555: 'auroratestnet',
  43114: 'avalanche',
  56: 'bsc',
  97: 'bsctestnet',
  42220: 'celo',
  1: 'ethereum',
  43113: 'fuji',
  5: 'goerli',
  42: 'kovan',
  1287: 'moonbasealpha',
  1284: 'moonbeam',
  80001: 'mumbai',
  10: 'optimism',
  420: 'optimismgoerli',
  69: 'optimismkovan',
  137: 'polygon',
  280: 'zksync2testnet',
};

export const chainIdToBlockTime = {
  44787: 5,
  42161: 3, // Fake
  421611: 3, // Fake
  421613: 3, // Fake
  1313161555: 3, // Fake
  43114: 2,
  56: 3,
  97: 3,
  42220: 5,
  1: 13,
  43113: 2,
  5: 15,
  42: 8,
  1287: 12,
  1284: 12,
  80001: 5,
  10: 3, // Fake
  420: 3, // Fake
  69: 3, // Fake
  137: 2,
  280: 2, // Closer to 1.2 actually
};

// Some block explorers use diff urls for their explorer
// api vs the ui, so setting overrides here
export const chainIdToExplorerApi = {
  44787: 'https://alfajores.celoscan.io',
  42161: 'https://api.arbiscan.io',
  421611: 'https://api-testnet.arbiscan.io',
  421613: 'https://api-goerli.arbiscan.io',
  43114: 'https://api.snowtrace.io',
  56: 'https://api.bscscan.com',
  97: 'https://api-testnet.bscscan.com',
  42220: 'https://api.celoscan.io',
  1: 'https://api.etherscan.io',
  43113: 'https://api-testnet.snowtrace.io',
  5: 'https://api-goerli.etherscan.io',
  42: 'https://api-kovan.etherscan.io',
  1287: 'https://api-moonbase.moonscan.io',
  1284: 'https://api-moonbeam.moonscan.io',
  80001: 'https://api-testnet.polygonscan.com',
  10: 'https://api-optimistic.etherscan.io',
  420: 'https://api-goerli-optimism.etherscan.io',
  69: 'https://api-kovan-optimistic.etherscan.io',
  137: 'https://api.polygonscan.com',
};

export const mainnetChains = [
  arbitrumChain,
  avalancheChain,
  bscChain,
  celoMainnetChain,
  chain.mainnet,
  moonbeamChain,
  chain.optimism,
  chain.polygon,
];

export const testnetChains = [
  alfajoresChain,
  chain.arbitrumGoerli,
  auroraTestnetChain,
  bscTestnetChain,
  fujiTestnetChain,
  chain.goerli,
  moonbaseAlphaChain,
  chain.optimismGoerli,
  polygonMumbaiChain,
  // zksync2testnetChain,
];

export const mainnetAndTestChains = [...mainnetChains, ...testnetChains];

export const allChains = [...allChainsWagmi, ...mainnetAndTestChains];

export const chainIdToChain = allChains.reduce<Record<number, Chain>>((result, chain) => {
  result[chain.id] = chain;
  return result;
}, {});
