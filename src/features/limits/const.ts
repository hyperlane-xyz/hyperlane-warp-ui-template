import { RouteLimit } from './types';

export const multiCollateralTokenLimits: RouteLimit[] = [
  {
    amountWei: 30000000000n, // 30000 USDC
    chains: ['arbitrum', 'base', 'ethereum', 'optimism', 'solanamainnet'],
    symbol: 'USDC',
  },
];
