import { IbcRoute, RouteType } from '../features/tokens/routes/types';

// Configs for manually-defined IBC-only routes
export const ibcRoutes: IbcRoute[] = [
  {
    type: RouteType.IbcNativeToHypNative,
    baseTokenCaip19Id: 'cosmos:celestia/ibcDenom:cosmos100000000000000000000000000000000000000',
    originCaip2Id: 'cosmos:celestia',
    originDecimals: 6,
    destCaip2Id: 'ethereum:169',
    destDecimals: 6,
    // Router on neutron
    baseRouterAddress: 'neutron1ch7x3xgpnj62weyes8vfada35zff6z59kt2psqhnx9gjnt2ttqdqtva3pa',
    // Also router on neutron
    originRouterAddress: 'neutron1ch7x3xgpnj62weyes8vfada35zff6z59kt2psqhnx9gjnt2ttqdqtva3pa',
    // Router on Manta
    destRouterAddress: '0x6Fae4D9935E2fcb11fC79a64e917fb2BF14DaFaa',
  },
];
