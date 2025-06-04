import { RouteLimit } from './types';

export const multiCollateralTokenLimits: RouteLimit[] = [
  {
    amountWei: 100000,
    symbol: 'USDC',
    chains: ['optimism', 'arbitrum'],
  },
];
