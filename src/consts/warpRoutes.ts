import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    // M0 mUSD on Ethereum (HubPortal)
    {
      chainName: 'ethereum',
      standard: TokenStandard.EvmM0PortalLite,
      addressOrDenom: '0x36f586A30502AE3afb555b8aA4dCc05d233c2ecE', // Portal address
      collateralAddressOrDenom: '0xaca92e438df0b2401ff60da7e4337b687a2435da', // mUSD token address
      decimals: 6,
      symbol: 'mUSD',
      name: 'MetaMask USD',
      logoURI: '/logos/musd.svg',
      connections: [
        {
          token: 'ethereum|linea|0x36f586A30502AE3afb555b8aA4dCc05d233c2ecE',
        },
        {
          token: 'ethereum|bsc|0x36f586A30502AE3afb555b8aA4dCc05d233c2ecE',
        },
      ],
    },
    // M0 mUSD on Linea (SpokePortal)
    {
      chainName: 'linea',
      standard: TokenStandard.EvmM0PortalLite,
      addressOrDenom: '0x36f586A30502AE3afb555b8aA4dCc05d233c2ecE', // Portal address (same as Ethereum)
      collateralAddressOrDenom: '0xaca92e438df0b2401ff60da7e4337b687a2435da', // mUSD token address
      decimals: 6,
      symbol: 'mUSD',
      name: 'MetaMask USD',
      logoURI: '/logos/musd.svg',
      connections: [
        {
          token: 'ethereum|ethereum|0x36f586A30502AE3afb555b8aA4dCc05d233c2ecE',
        },
      ],
    },
    {
      chainName: 'bsc',
      standard: TokenStandard.EvmM0PortalLite,
      addressOrDenom: '0x36f586A30502AE3afb555b8aA4dCc05d233c2ecE', // Portal address (same as Ethereum)
      collateralAddressOrDenom: '0xaca92e438df0b2401ff60da7e4337b687a2435da', // mUSD token address
      decimals: 6,
      symbol: 'mUSD',
      name: 'MetaMask USD',
      logoURI: '/logos/musd.svg',
      connections: [
        {
          token: 'ethereum|ethereum|0x36f586A30502AE3afb555b8aA4dCc05d233c2ecE',
        },
      ],
    },
  ],
  options: {},
};
