export const SWAP_CHAINS = {
  origin: { chainId: 42161, name: 'Arbitrum', domainId: 42161 },
  destination: { chainId: 8453, name: 'Base', domainId: 8453 },
};

export const SWAP_CONTRACTS = {
  universalRouterArb: '',
  universalRouterBase: '',
  icaRouterArb: '0xCd2858B6bCaA9b628EBc4892F578b7d37E9ec229',
  icaRouterBase: '0x5ed29F0f32636CC69b0c189D5ec82C09DE7Cb0a7',
  usdcArb: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  usdcBase: '',
};

export const DEFAULT_SLIPPAGE = 0.005;
