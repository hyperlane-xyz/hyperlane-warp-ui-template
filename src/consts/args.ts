import { ChainMap } from '@hyperlane-xyz/sdk';

export enum WARP_QUERY_PARAMS {
  ORIGIN = 'origin',
  DESTINATION = 'destination',
  TOKEN = 'token',
}

export enum CHAIN_NAMES {
  BASE = 'base',
  CELO = 'celo',
  ETHEREUM = 'ethereum',
  OPTIMISM = 'optimism',
}

export const tipCardChains: ChainMap<{
  token: string;
  chainId: number;
  chainName: string;
  tokenName: string;
}> = {
  [CHAIN_NAMES.BASE]: {
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    tokenName: 'USDC',
    chainId: 8453,
    chainName: CHAIN_NAMES.BASE,
  },
  [CHAIN_NAMES.OPTIMISM]: {
    token: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    tokenName: 'USDT',
    chainId: 10,
    chainName: CHAIN_NAMES.OPTIMISM,
  },
};

export const baseChain = tipCardChains[CHAIN_NAMES.BASE];
export const optimismChain = tipCardChains[CHAIN_NAMES.OPTIMISM];
export const openUsdtTokenAddress = '0x1217BfE6c773EEC6cc4A38b5Dc45B92292B6E189';
