import { IbcRoute, IbcToWarpRoute, RouteType } from '../features/tokens/routes/types';

// Configs for manually-defined IBC-only routes
export const ibcRoutes: Array<IbcRoute | IbcToWarpRoute> = [
  {
    type: RouteType.IbcNativeToIbcNative,
    baseTokenCaip19Id: 'cosmos:celestia/ibcDenom:cosmos100000000000000000000000000000000000000',
    originCaip2Id: 'cosmos:celestia',
    originDecimals: 6,
    destCaip2Id: 'cosmos:neutron-1',
    destDecimals: 6,
    originIbcDenom: 'utia',
    sourcePort: 'transfer',
    sourceChannel: 'channel-8',
    // IBC Tia on Neutron
    derivedIbcDenom: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
  },
  {
    type: RouteType.IbcNativeToHypSynthetic,
    baseTokenCaip19Id: 'cosmos:celestia/ibcDenom:cosmos100000000000000000000000000000000000000',
    originCaip2Id: 'cosmos:celestia',
    originDecimals: 6,
    destCaip2Id: 'ethereum:169',
    destDecimals: 6,
    originIbcDenom: 'utia',
    sourcePort: 'transfer',
    sourceChannel: 'channel-8',
    // IBC Tia on Neutron
    derivedIbcDenom: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
    intermediateCaip2Id: 'cosmos:neutron-1',
    // Router on Neutron for Manta
    intermediateRouterAddress: 'neutron1ch7x3xgpnj62weyes8vfada35zff6z59kt2psqhnx9gjnt2ttqdqtva3pa',
    // Router on Manta
    destRouterAddress: '0x6Fae4D9935E2fcb11fC79a64e917fb2BF14DaFaa',
  },
  {
    type: RouteType.IbcNativeToHypSynthetic,
    baseTokenCaip19Id: 'cosmos:celestia/ibcDenom:cosmos100000000000000000000000000000000000000',
    originCaip2Id: 'cosmos:celestia',
    originDecimals: 6,
    destCaip2Id: 'ethereum:42161',
    destDecimals: 6,
    originIbcDenom: 'utia',
    sourcePort: 'transfer',
    sourceChannel: 'channel-8',
    // IBC Tia on Neutron
    derivedIbcDenom: 'ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7',
    intermediateCaip2Id: 'cosmos:neutron-1',
    // Router on Neutron for Arbitrum
    intermediateRouterAddress: 'neutron1jyyjd3x0jhgswgm6nnctxvzla8ypx50tew3ayxxwkrjfxhvje6kqzvzudq',
    // Router on Arbitrum
    destRouterAddress: '0xD56734d7f9979dD94FAE3d67C7e928234e71cD4C',
  },
];
