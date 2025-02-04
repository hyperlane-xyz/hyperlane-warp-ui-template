import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

const ROUTER = '0x6d2175B89315A9EB6c7eA71fDE54Ac0f294aDC34';
const ITT = '0x5f94BC7Fb4A2779fef010F96b496cD36A909E818';

// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    {
      addressOrDenom: ROUTER,
      chainName: 'optimismsepolia',
      collateralAddressOrDenom: ITT,
      connections: [
        {
          token: 'ethereum|basesepolia|' + ITT,
        },
        {
          token: 'ethereum|arbitrumsepolia|' + ITT,
        },
        {
          token: 'ethereum|sepolia|' + ITT,
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/ETH/logo.svg',
      name: 'ITT',
      standard: TokenStandard.EvmIntent,
      symbol: 'ITT',
    },
    {
      addressOrDenom: ROUTER,
      chainName: 'basesepolia',
      collateralAddressOrDenom: ITT,
      connections: [
        {
          token: 'ethereum|optimismsepolia|' + ITT,
        },
        {
          token: 'ethereum|arbitrumsepolia|' + ITT,
        },
        {
          token: 'ethereum|sepolia|' + ITT,
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/ETH/logo.svg',
      name: 'ITT',
      standard: TokenStandard.EvmIntent,
      symbol: 'ITT',
    },
    {
      addressOrDenom: ROUTER,
      chainName: 'arbitrumsepolia',
      collateralAddressOrDenom: ITT,
      connections: [
        {
          token: 'ethereum|optimismsepolia|' + ITT,
        },
        {
          token: 'ethereum|basesepolia|' + ITT,
        },
        {
          token: 'ethereum|sepolia|' + ITT,
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/ETH/logo.svg',
      name: 'ITT',
      standard: TokenStandard.EvmIntent,
      symbol: 'ITT',
    },
    {
      addressOrDenom: ROUTER,
      chainName: 'sepolia',
      collateralAddressOrDenom: ITT,
      connections: [
        {
          token: 'ethereum|optimismsepolia|' + ITT,
        },
        {
          token: 'ethereum|arbitrumsepolia|' + ITT,
        },
        {
          token: 'ethereum|basesepolia|' + ITT,
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/ETH/logo.svg',
      name: 'ITT',
      standard: TokenStandard.EvmIntent,
      symbol: 'ITT',
    },
    {
      addressOrDenom: ROUTER,
      chainName: 'optimismsepolia',
      connections: [
        {
          token: 'ethereum|basesepolia|',
        },
        {
          token: 'ethereum|arbitrumsepolia|',
        },
        {
          token: 'ethereum|sepolia|',
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/ETH/logo.svg',
      name: 'ETH',
      standard: TokenStandard.EvmIntentNative,
      symbol: 'ETH',
    },
    {
      addressOrDenom: ROUTER,
      chainName: 'basesepolia',
      connections: [
        {
          token: 'ethereum|optimismsepolia|',
        },
        {
          token: 'ethereum|arbitrumsepolia|',
        },
        {
          token: 'ethereum|sepolia|',
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/ETH/logo.svg',
      name: 'ETH',
      standard: TokenStandard.EvmIntentNative,
      symbol: 'ETH',
    },
    {
      addressOrDenom: ROUTER,
      chainName: 'arbitrumsepolia',
      connections: [
        {
          token: 'ethereum|optimismsepolia|',
        },
        {
          token: 'ethereum|basesepolia|',
        },
        {
          token: 'ethereum|sepolia|',
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/ETH/logo.svg',
      name: 'ETH',
      standard: TokenStandard.EvmIntentNative,
      symbol: 'ETH',
    },
    {
      addressOrDenom: ROUTER,
      chainName: 'sepolia',
      connections: [
        {
          token: 'ethereum|optimismsepolia|',
        },
        {
          token: 'ethereum|arbitrumsepolia|',
        },
        {
          token: 'ethereum|basesepolia|',
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/ETH/logo.svg',
      name: 'ETH',
      standard: TokenStandard.EvmIntentNative,
      symbol: 'ETH',
    },
  ],
  options: {},
};
