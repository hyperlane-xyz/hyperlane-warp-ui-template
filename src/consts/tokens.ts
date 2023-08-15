import { WarpTokenConfig } from '../features/tokens/types';

export const tokenList: WarpTokenConfig = [
  // bsc
  {
    type: 'collateral',
    chainId: 56,
    address: '0x37a56cdcD83Dce2868f721De58cB3830C44C6303',
    hypCollateralAddress: '0x69B42169AbD9D2C073f12768a1B358bcD79be1e8',
    symbol: 'ZBC',
    name: 'Zebec',
    decimals: 9,
  },

  // nautilus
  {
    type: 'native',
    chainId: 22222,
    hypNativeAddress: '0x09edd60B833685FDd6dda49f160F43ED9E49C321',
    symbol: 'ZBC',
    name: 'Zebec',
    decimals: 18,
  },

  // solana
  {
    type: 'collateral',
    chainId: 1399811149,
    address: 'zebeczgi5fSEtbpfQKVZKCJ3WgYXxjkMUkNNx7fLKAF',
    hypCollateralAddress: 'FTbMPUDfbejo8MRze4Mom4hM7HC2yb7KaHFzRTdLCoG7',
    name: 'Zebec',
    symbol: 'ZBC',
    decimals: 9,
    isSpl2022: false,
  },
];
