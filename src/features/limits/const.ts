import { RouteLimit } from './types';

export const multiCollateralTokenLimits: RouteLimit[] = [
  {
    amountWei: 1000000n, // 1 USDC
    symbol: 'USDC',
    chains: ['optimism', 'arbitrum'],
  },
];
