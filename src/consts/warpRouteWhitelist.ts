// A list of warp route config IDs to be included in the app
// Warp Route IDs use format `SYMBOL/chainname1-chainname2...` where chains are ordered alphabetically
// If left null, all warp routes in the configured registry will be included
// If set to a list (including an empty list), only the specified routes will be included
export const warpRouteWhitelist: Array<string> | null = [
  'oUSDT/base-bitlayer-celo-ethereum-fraxtal-ink-linea-lisk-mantle-metal-metis-mode-optimism-ronin-soneium-sonic-superseed-unichain-worldchain',
];
