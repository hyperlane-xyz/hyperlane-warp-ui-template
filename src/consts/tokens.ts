import { WarpTokenConfig } from '../features/tokens/types';

export const tokenList: WarpTokenConfig = [
  // bsctestnet
  {
    type: 'collateral',
    chainId: 97,
    address: '0x64544969ed7ebf5f083679233325356ebe738930',
    hypCollateralAddress: '0x31b5234A896FbC4b3e2F7237592D054716762131',
  },

  // proteustestnet
  {
    type: 'native',
    chainId: 88002,
    hypNativeAddress: '0x34A9af13c5555BAD0783C220911b9ef59CfDBCEf',
  },

  // solanadevnet
  {
    type: 'native',
    chainId: 1399811151,
    hypNativeAddress: 'PJH5QAbxAqrrnSXfH3GHR8icua8CDFZmo97z91xmpvx',
  },
];
