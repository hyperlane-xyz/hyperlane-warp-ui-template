import {
  chainAddresses,
  chainMetadata,
  warpConfigToWarpAddresses,
  warpRouteConfigs,
} from '@hyperlane-xyz/registry';

export interface SwapChainConfig {
  chainId: number;
  domainId: number;
  universalRouter: string;
  icaRouter: string;
  /** Token used as bridge intermediary (e.g. USDC) */
  bridgeToken: string;
  /** HypCollateral warp route for the bridge token */
  warpRoute: string;
  wrappedNative: string;
  /** Uniswap V3 QuoterV2 contract for swap price quotes */
  quoterV2: string;
  /** Phase 2: warp route the ICA can use to bridge tokens back */
  icaBridgeRoute: string;
}

export const DEMO_WARP_ROUTE_ID = 'USDC/eclipsemainnet';
export const DEMO_ORIGIN_CHAIN = 'optimism';
export const DEMO_DESTINATION_CHAIN = 'base';

const demoWarpRouteConfig = warpRouteConfigs[DEMO_WARP_ROUTE_ID];
if (!demoWarpRouteConfig) {
  throw new Error(`Missing warp route config for ${DEMO_WARP_ROUTE_ID}`);
}

const demoWarpAddresses = warpConfigToWarpAddresses(demoWarpRouteConfig);

function requireRouteAddress(chainName: string): string {
  const byType = demoWarpAddresses[chainName];
  if (!byType) throw new Error(`Missing warp route address for ${chainName} in ${DEMO_WARP_ROUTE_ID}`);
  const routeAddress = Object.values(byType)[0];
  if (!routeAddress)
    throw new Error(`Missing concrete route token address for ${chainName} in ${DEMO_WARP_ROUTE_ID}`);
  return routeAddress;
}

function requireCollateralAddress(chainName: string): string {
  const routeToken = demoWarpRouteConfig.tokens.find((token) => token.chainName === chainName);
  if (!routeToken?.collateralAddressOrDenom) {
    throw new Error(`Missing collateral token address for ${chainName} in ${DEMO_WARP_ROUTE_ID}`);
  }
  return routeToken.collateralAddressOrDenom;
}

function requireIcaRouter(chainName: string): string {
  const icaRouter = chainAddresses[chainName]?.interchainAccountRouter;
  if (!icaRouter) throw new Error(`Missing ICA router for ${chainName}`);
  return icaRouter;
}

function requireChainMetadata(chainName: string) {
  const metadata = chainMetadata[chainName];
  if (!metadata) throw new Error(`Missing chain metadata for ${chainName}`);
  return metadata;
}

function requireNumericId(value: string | number, field: string, chainName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field} for ${chainName}`);
  return parsed;
}

const demoOriginMetadata = requireChainMetadata(DEMO_ORIGIN_CHAIN);
const demoDestinationMetadata = requireChainMetadata(DEMO_DESTINATION_CHAIN);

const DEMO_OPTIMISM_USDC_WARP_ROUTE = requireRouteAddress(DEMO_ORIGIN_CHAIN);
const DEMO_BASE_USDC_WARP_ROUTE = requireRouteAddress(DEMO_DESTINATION_CHAIN);
const DEMO_OPTIMISM_USDC_COLLATERAL = requireCollateralAddress(DEMO_ORIGIN_CHAIN);
const DEMO_BASE_USDC_COLLATERAL = requireCollateralAddress(DEMO_DESTINATION_CHAIN);

export const SWAP_CHAIN_CONFIGS: Record<string, SwapChainConfig> = {
  optimism: {
    chainId: requireNumericId(demoOriginMetadata.chainId, 'chainId', DEMO_ORIGIN_CHAIN),
    domainId: requireNumericId(demoOriginMetadata.domainId, 'domainId', DEMO_ORIGIN_CHAIN),
    universalRouter: '0xa9606caaC711Ac816E568356187EC7a009500Eb2',
    icaRouter: requireIcaRouter(DEMO_ORIGIN_CHAIN),
    bridgeToken: DEMO_OPTIMISM_USDC_COLLATERAL,
    warpRoute: DEMO_OPTIMISM_USDC_WARP_ROUTE,
    wrappedNative: '0x4200000000000000000000000000000000000006',
    quoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    icaBridgeRoute: '',
  },
  base: {
    chainId: requireNumericId(demoDestinationMetadata.chainId, 'chainId', DEMO_DESTINATION_CHAIN),
    domainId: requireNumericId(demoDestinationMetadata.domainId, 'domainId', DEMO_DESTINATION_CHAIN),
    universalRouter: '0xa9606caaC711Ac816E568356187EC7a009500Eb2',
    icaRouter: requireIcaRouter(DEMO_DESTINATION_CHAIN),
    bridgeToken: DEMO_BASE_USDC_COLLATERAL,
    warpRoute: DEMO_BASE_USDC_WARP_ROUTE,
    wrappedNative: '0x4200000000000000000000000000000000000006',
    quoterV2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    icaBridgeRoute: '0x37e637891A558B5b621723cbf8Fc771525f280C1',
  },
};

export const DEFAULT_SLIPPAGE = 0.005;

export function getSwapConfig(chainName: string): SwapChainConfig | undefined {
  return SWAP_CHAIN_CONFIGS[chainName];
}

export function isSwapSupported(origin: string, destination: string): boolean {
  return origin === 'optimism' && destination === 'base';
}

export function isDemoSwapBridgePath(params: {
  originChainName: string;
  destinationChainName: string;
  destinationTokenAddress: string;
  destinationRouteAddress?: string;
}): boolean {
  const destinationTokenAddress = params.destinationTokenAddress.toLowerCase();
  const canonicalBaseCollateral = DEMO_BASE_USDC_COLLATERAL.toLowerCase();
  const canonicalBaseRoute = DEMO_BASE_USDC_WARP_ROUTE.toLowerCase();

  if (
    params.originChainName !== DEMO_ORIGIN_CHAIN ||
    params.destinationChainName !== DEMO_DESTINATION_CHAIN
  ) {
    return false;
  }

  if (destinationTokenAddress === canonicalBaseRoute) return false;
  if (destinationTokenAddress !== canonicalBaseCollateral) return false;

  return true;
}

/**
 * Resolve the address Uniswap should use for the swap input token.
 * Warp route tokens (HypNative, HypCollateral) use their own contract addresses
 * which Uniswap doesn't know about. This maps them to the underlying swappable token.
 */
export function getSwappableAddress(token: {
  isNative: () => boolean;
  isHypNative: () => boolean;
  collateralAddressOrDenom?: string;
  addressOrDenom: string;
  chainName: string;
}): string | undefined {
  const config = getSwapConfig(token.chainName);
  if (!config) return undefined;
  if (token.isNative() || token.isHypNative()) return config.wrappedNative;
  return token.collateralAddressOrDenom || token.addressOrDenom;
}
