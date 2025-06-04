import { RouteLimit } from './types';

export const multiCollateralTokenLimits: RouteLimit[] = [
  {
    amount: 50000n,
    symbol: 'USDC',
    chains: ['optimism', 'arbitrum'],
  },
];
