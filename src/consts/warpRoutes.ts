import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';
// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command

const assetReserveSepolia = '0x8E57C1FAd22e4BE6C757ac49e154261Cf9E15f8A';
const assetReserveOptimismSepolia = '0xF3815caFc75450C00c01a3D14fa03f88cC316d26';
const assetReserveArbitrumSepolia = '0x93807fCe9ef150a0ea820F704577ba859Ecf25a6';
const assetReserveFuji = '0x901B462853519FF5b3d235b355a23737736538eB';
//const assetReserveBaseSepolia = '0xc06Ce41AB23c070F25ea3fa41Bf8f1A9e98f34f5';

const usdcSepolia = '0xfE69cC79d53cd27BC9A4B39d309F309C2B614114';
const usdcOptimismSepolia = '0x6711C699d048Eb2e46a7519eA8506041c2E91D6B';
//const usdcBaseSepolia = '0x0C338bB6b49F82b6C9BC2081785AEbEfc228DcB6';
const usdcArbitrumSepolia = '0xaC28F48c835fA1Faa510e7C31A6E308882f1C097';
const usdcFuji = '0x277cAAC382cb1b1087598e710bCf96bAF218f9F9';

const usdSepoliaConnection = `ethereum|sepolia|${usdcSepolia}`;
const usdOptimismSepoliaConnection = `ethereum|optimismsepolia|${usdcOptimismSepolia}`;
const usdArbitrumSepoliaConnection = `ethereum|arbitrumsepolia|${usdcArbitrumSepolia}`;
const usdFujiConnection = `ethereum|fuji|${usdcFuji}`;

export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    {
      chainName: 'sepolia',
      addressOrDenom: assetReserveSepolia,
      collateralAddressOrDenom: usdcSepolia,
      connections: [
        {
          token: usdArbitrumSepoliaConnection,
        },
        {
          token: usdOptimismSepoliaConnection,
        },
        {
          token: usdFujiConnection,
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/USDC/logo.svg',
      name: 'USDC',
      standard: TokenStandard.EvmKhalaniIntent,
      symbol: 'USDC',
    },
    {
      chainName: 'optimismsepolia',
      addressOrDenom: assetReserveOptimismSepolia,
      collateralAddressOrDenom: usdcOptimismSepolia,
      connections: [
        {
          token: usdArbitrumSepoliaConnection,
        },
        {
          token: usdSepoliaConnection,
        },
        {
          token: usdFujiConnection,
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/USDC/logo.svg',
      name: 'USDC',
      standard: TokenStandard.EvmKhalaniIntent,
      symbol: 'USDC',
    },
    {
      chainName: 'fuji',
      addressOrDenom: assetReserveFuji,
      collateralAddressOrDenom: usdcFuji,
      connections: [
        {
          token: usdArbitrumSepoliaConnection,
        },
        {
          token: usdSepoliaConnection,
        },
        {
          token: usdOptimismSepoliaConnection,
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/USDC/logo.svg',
      name: 'USDC',
      standard: TokenStandard.EvmKhalaniIntent,
      symbol: 'USDC',
    },
    {
      chainName: 'arbitrumsepolia',
      addressOrDenom: assetReserveArbitrumSepolia,
      collateralAddressOrDenom: usdcArbitrumSepolia,
      connections: [
        {
          token: usdFujiConnection,
        },
        {
          token: usdSepoliaConnection,
        },
        {
          token: usdOptimismSepoliaConnection,
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/USDC/logo.svg',
      name: 'USDC',
      standard: TokenStandard.EvmKhalaniIntent,
      symbol: 'USDC',
    },
  ],
  options: {},
};
