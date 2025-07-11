import { RouteLimit } from './types';

export const multiCollateralTokenLimits: RouteLimit[] = [
  {
    amountWei: 10000000000n, // 10000 USDC
    chains: ['arbitrum', 'base', 'ethereum', 'optimism', 'solanamainnet'],
    symbol: 'USDC',
  },
];
