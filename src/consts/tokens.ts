import { WarpTokenConfig } from '../features/tokens/types';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenList: WarpTokenConfig = [
  // Sepolia Eth to Plume
  {
    type: 'native',
    chainId: 11155111,
    hypNativeAddress: '0xd99eA1D8b9542D35252504DDd59EDe8C43FB15fd',
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
    logoURI: '/logos/weth.png',
  },
];
