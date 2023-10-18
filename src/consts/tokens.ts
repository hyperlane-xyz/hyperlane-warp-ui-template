import { WarpTokenConfig } from '../features/tokens/types';

export const tokenList: WarpTokenConfig = [
  // Example collateral token for an EVM chain
  {
    chainId: 1,
    name: 'Solidly',
    symbol: 'SOLID',
    decimals: 18,
    type: 'collateral',
    address: '0x777172D858dC1599914a1C4c6c9fC48c99a60990',
    hypCollateralAddress: '0x8D052Eeb81477634450102e2463820744046bD6d',
    isNft: false,
  },
];
