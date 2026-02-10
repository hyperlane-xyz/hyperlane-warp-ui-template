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
  /** Phase 2: warp route the ICA can use to bridge tokens back */
  icaBridgeRoute: string;
}

export const SWAP_CHAIN_CONFIGS: Record<string, SwapChainConfig> = {
  arbitrum: {
    chainId: 42161,
    domainId: 42161,
    universalRouter: '',
    icaRouter: '0xCd2858B6bCaA9b628EBc4892F578b7d37E9ec229',
    bridgeToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    warpRoute: '0xAd4350Ee0f9f5b85BaB115425426086Ae8384ebb',
    wrappedNative: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    icaBridgeRoute: '',
  },
  base: {
    chainId: 8453,
    domainId: 8453,
    universalRouter: '',
    icaRouter: '0x5ed29F0f32636CC69b0c189D5ec82C09DE7Cb0a7',
    bridgeToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    warpRoute: '0x37e637891A558B5b621723cbf8Fc771525f280C1',
    wrappedNative: '0x4200000000000000000000000000000000000006',
    icaBridgeRoute: '',
  },
};

export const DEFAULT_SLIPPAGE = 0.005;

export function getSwapConfig(chainName: string): SwapChainConfig | undefined {
  return SWAP_CHAIN_CONFIGS[chainName];
}

export function isSwapSupported(origin: string, destination: string): boolean {
  return (
    origin !== destination && origin in SWAP_CHAIN_CONFIGS && destination in SWAP_CHAIN_CONFIGS
  );
}
