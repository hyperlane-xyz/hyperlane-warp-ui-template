import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    {
      // The ChainName of the token
      chainName: 'ethereum',
      // See https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/token/TokenStandard.ts
      standard: TokenStandard.EvmHypCollateral,
      // The token metadata (decimals, symbol, name)
      decimals: 18,
      symbol: 'pzETH',
      name: 'Renzo Restaked LST',
      // The router address
      addressOrDenom: '0x1D622da2ce4C4D9D4B0611718cb3BcDcAd008DD4',
      // The address of the underlying collateral token
      collateralAddressOrDenom: '0x8c9532a60e0e7c6bbd2b2c1303f63ace1c3e9811',
      // A path to a token logo image
      logoURI: 'https://s2.coinmarketcap.com/static/img/coins/128x128/32298.png',
      // The list of tokens this one is connected to
      connections: [ { token: 'sealevel|solana|GiP8GwN1GsscVJvmKSD4muDEihRzZRa9mxnS1Toi64pa' } ]
    },
    {
      chainName: 'solana',
      standard: TokenStandard.SealevelHypSynthetic,
      decimals: 9,
      symbol: 'pzETH',
      name: 'Renzo Restaked LST',
      addressOrDenom: 'GiP8GwN1GsscVJvmKSD4muDEihRzZRa9mxnS1Toi64pa',
      collateralAddressOrDenom: 'GiP8GwN1GsscVJvmKSD4muDEihRzZRa9mxnS1Toi64pa',
      logoURI: 'https://s2.coinmarketcap.com/static/img/coins/128x128/32298.png',
      connections: [ { token: 'ethereum|ethereum|0x1D622da2ce4C4D9D4B0611718cb3BcDcAd008DD4' } ]
    }
  ],
  options: {},
};
