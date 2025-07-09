import { RouteLimit } from './types';

export const multiCollateralTokenLimits: RouteLimit[] = [
  {
    amountWei: 5000000000n, // 5000 USDC
    chains: ['arbitrum', 'base', 'ethereum', 'optimism'],
    symbol: 'USDC',
  },
];
