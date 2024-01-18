import { IbcRoute, IbcToWarpRoute, RouteType } from '../features/tokens/routes/types';

// Configs for manually-defined IBC-only routes
export const ibcRoutes: Array<IbcRoute | IbcToWarpRoute> = [
  {
    type: RouteType.IbcNativeToIbcNative,
    baseTokenCaip19Id: 'cosmos:injective-1/ibcDenom:cosmos100000000000000000000000000000000000000',
    originCaip2Id: 'cosmos:injective-1',
    originDecimals: 6,
    destCaip2Id: 'cosmos:neutron-1',
    destDecimals: 6,
    originIbcDenom: 'inj',
    sourcePort: 'transfer',
    sourceChannel: 'channel-177',
    // IBC INJ on Neutron
    derivedIbcDenom: 'ibc/69BEAFC2FDF0C6F0124520B0A06E432AD8490732DFC309337FA6C307124FDABC',
  },
];
