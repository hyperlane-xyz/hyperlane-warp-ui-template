import { IbcRoute, RouteType } from '../features/tokens/routes/types';

// Configs for manually-defined IBC-only routes
export const ibcRoutes: IbcRoute[] = [
  {
    type: RouteType.IbcNativeToIbcNative,
    baseTokenCaip19Id: 'cosmos:celestia/ibcDenom:cosmos100000000000000000000000000000000000000',
    originCaip2Id: 'cosmos:celestia',
    originDecimals: 6,
    destCaip2Id: 'ethereum:169',
    destDecimals: 6,
    // Empty fields required to simplify types
    baseRouterAddress: '',
    originRouterAddress: '',
    destRouterAddress: '',
  },
];
