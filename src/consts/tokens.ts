import { WarpTokenConfig } from '../features/tokens/types';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenList: WarpTokenConfig = [
  // Example collateral token for an EVM chain
  {
    type: 'native',
    chainId: 'injective-888',
    name: 'Injective Coin',
    symbol: 'INJ',
    decimals: 6,
    hypNativeAddress: 'inj1w7mgmu3s2agdpz9tg3c42gay7dklm57qtv98nu',
    logoURI: '/logos/ECLIP.png',
  },
];
