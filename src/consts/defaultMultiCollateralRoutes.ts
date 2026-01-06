import { DefaultMultiCollateralRoutes } from '../features/tokens/types';

// Default multi-collateral warp route configuration
// Maps: chainName -> collateralAddress -> warpRouteAddressOrDenom
//
// For ERC20/collateralized tokens:
//   { "ethereum": { "0xUSDC...": "0xWarpRoute..." } }
//
// For native tokens (HypNative), use 'native' as the key:
//   { "ethereum": { "native": "0xWarpRoute..." } }
export const defaultMultiCollateralRoutes: DefaultMultiCollateralRoutes = {
  arbitrum: {
    // USDC
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831': '0xAd4350Ee0f9f5b85BaB115425426086Ae8384ebb',
  },
  base: {
    // USDC
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913': '0x37e637891A558B5b621723cbf8Fc771525f280C1',
  },
  ethereum: {
    // USDC
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': '0xe1De9910fe71cC216490AC7FCF019e13a34481D7',
  },
  optimism: {
    // USDC
    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85': '0x02bFd67829317D666dc7dFA030F18eaCC12c2cfb',
  },
  polygon: {
    // USDC
    '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359': '0xCb9F833f4d6D9Bb9767CDb25c487DA54D67731D6',
  },
  solanamainnet: {
    // USDC
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: '3EpVCPUgyjq2MfGeCttyey6bs5zya5wjYZ2BE6yDg6bm',
  },
  unichain: {
    // USDC
    '0x078D782b760474a361dDA0AF3839290b0EF57AD6': '0xa7E4dC4078bAc6e97Eec52a4F7642fF51cbb17C1',
  },
};
