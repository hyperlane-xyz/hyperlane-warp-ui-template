export enum RouteType {
  CollateralToCollateral = 'collateralToCollateral',
  CollateralToSynthetic = 'collateralToSynthetic',
  SyntheticToSynthetic = 'syntheticToSynthetic',
  SyntheticToCollateral = 'syntheticToCollateral',
  IbcNativeToIbcNative = 'ibcNativeToIbcNative',
  IbcNativeToHypNative = 'ibcNativeToHypNative',
}

interface BaseRoute {
  type: RouteType;
  // The underlying 'collateralized' token:
  baseTokenCaip19Id: TokenCaip19Id;
  originCaip2Id: ChainCaip2Id;
  originDecimals: number;
  destCaip2Id: ChainCaip2Id;
  destDecimals: number;
  // The underlying token on the destination chain
  // Only set for CollateralToCollateral routes (b.c. sealevel needs it)
  destTokenCaip19Id?: TokenCaip19Id;
}

export interface HypRoute extends BaseRoute {
  type:
    | RouteType.CollateralToCollateral
    | RouteType.CollateralToSynthetic
    | RouteType.SyntheticToCollateral
    | RouteType.SyntheticToSynthetic;
  baseRouterAddress: Address;
  originRouterAddress: Address;
  destRouterAddress: Address;
}

interface BaseIbcRoute extends BaseRoute {
  originIbcDenom: string;
  sourcePort: string;
  sourceChannel: string;
  derivedIbcDenom: string;
}

export interface IbcRoute extends BaseIbcRoute {
  type: RouteType.IbcNativeToIbcNative;
}

export interface IbcToHypRoute extends BaseIbcRoute {
  type: RouteType.IbcNativeToHypNative;
  intermediateCaip2Id: ChainCaip2Id;
  intermediateRouterAddress: Address;
  destRouterAddress: Address;
}

export type Route = HypRoute | IbcRoute | IbcToHypRoute;

export type RoutesMap = Record<ChainCaip2Id, Record<ChainCaip2Id, Route[]>>;
