import { RouteLimit } from './types';

export const multiCollateralTokenLimits: RouteLimit[] = [
  {
    amountWei: 1000000000n,
    chains: ['arbitrum', 'base', 'ethereum', 'optimism'],
    symbol: 'USDC',
  },
];
