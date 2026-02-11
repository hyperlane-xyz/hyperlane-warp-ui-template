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

export const SWAP_CHAIN_CONFIGS: Record<string, SwapChainConfig> = {
  arbitrum: {
    chainId: 42161,
    domainId: 42161,
    universalRouter: '0x21672Ef3f1a6D4Af2026BA9b872657d0cF75f41C',
    icaRouter: '0xF90A3d406C6F8321fe118861A357F4D7107760D7',
    bridgeToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    warpRoute: '0xAd4350Ee0f9f5b85BaB115425426086Ae8384ebb',
    wrappedNative: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    quoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    icaBridgeRoute: '',
  },
  base: {
    chainId: 8453,
    domainId: 8453,
    universalRouter: '0xa9606caaC711Ac816E568356187EC7a009500Eb2',
    icaRouter: '0x44647Cd983E80558793780f9a0c7C2aa9F384D07',
    bridgeToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    warpRoute: '0x37e637891A558B5b621723cbf8Fc771525f280C1',
    wrappedNative: '0x4200000000000000000000000000000000000006',
    quoterV2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    icaBridgeRoute: '0x37e637891A558B5b621723cbf8Fc771525f280C1',
  },
};

export const DEFAULT_SLIPPAGE = 0.005;
export const DEMO_ORIGIN_CHAIN = 'arbitrum';
export const DEMO_DESTINATION_CHAIN = 'base';

export function getSwapConfig(chainName: string): SwapChainConfig | undefined {
  return SWAP_CHAIN_CONFIGS[chainName];
}

export function isSwapSupported(origin: string, destination: string): boolean {
  return (
    origin !== destination && origin in SWAP_CHAIN_CONFIGS && destination in SWAP_CHAIN_CONFIGS
  );
}

export function isDemoSwapBridgePath(params: {
  originChainName: string;
  destinationChainName: string;
  destinationTokenAddress: string;
}): boolean {
  const baseConfig = getSwapConfig(DEMO_DESTINATION_CHAIN);
  if (!baseConfig) return false;

  return (
    params.originChainName === DEMO_ORIGIN_CHAIN &&
    params.destinationChainName === DEMO_DESTINATION_CHAIN &&
    params.destinationTokenAddress.toLowerCase() === baseConfig.bridgeToken.toLowerCase()
  );
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
