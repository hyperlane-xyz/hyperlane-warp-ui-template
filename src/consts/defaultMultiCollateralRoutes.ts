import { DefaultMultiCollateralRoutes } from '../features/tokens/types';

// Default multi-collateral warp route configuration
// Maps: chainName -> collateralAddress -> warpRouteAddressOrDenom
//
// For ERC20/collateralized tokens:
//   { "ethereum": { "0xUSDC...": "0xWarpRoute..." } }
//
// For native tokens (HypNative), use 'native' as the key:
//   { "ethereum": { "native": "0xWarpRoute..." } }
export const defaultMultiCollateralRoutes: DefaultMultiCollateralRoutes | undefined = undefined;
