import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';


// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    {
      chainName: 'basesepolia',
      standard: TokenStandard.EvmHypCollateral,
      decimals: 18,
      symbol: 'EDGEN',
      name: 'LayerEdge',
      addressOrDenom: '0x64508Ee3af87a7F26D4F531B10E13585dA29f15b', // Hyperlane token contract on Base Sepolia
      collateralAddressOrDenom: '0x64508Ee3af87a7F26D4F531B10E13585dA29f15b', // Underlying token (same as hyperlane token in this case)
      connections: [
        {
          token: 'ethereum|bsctestnet|0x83c2084CC653c5149b3f429503188836fe280e71',
        },
      ],
    },
    {
      chainName: 'bsctestnet',
      standard: TokenStandard.EvmHypSynthetic,
      decimals: 18,
      symbol: 'EDGEN',
      name: 'LayerEdge',
      addressOrDenom: '0x83c2084CC653c5149b3f429503188836fe280e71', // Hyperlane synthetic token on BSC Testnet
      connections: [
        {
          token: 'ethereum|basesepolia|0x64508Ee3af87a7F26D4F531B10E13585dA29f15b', // Actual basesepolia token address
        },
      ],
    },
  ],
  options: {},
};
