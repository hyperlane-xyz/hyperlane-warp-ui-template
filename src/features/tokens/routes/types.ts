export enum RouteType {
  CollateralToCollateral = 'collateralToCollateral',
  CollateralToSynthetic = 'collateralToSynthetic',
  SyntheticToSynthetic = 'syntheticToSynthetic',
  SyntheticToCollateral = 'syntheticToCollateral',
  IbcNativeToHypNative = 'IbcNativeToHypNative',
}

interface BaseRoute {
  type: RouteType;
  // The underlying 'collateralized' token:
  baseTokenCaip19Id: TokenCaip19Id;
  baseRouterAddress: Address;
  originCaip2Id: ChainCaip2Id;
  originRouterAddress: Address;
  originDecimals: number;
  destCaip2Id: ChainCaip2Id;
  destRouterAddress: Address;
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
}

export interface IbcRoute extends BaseRoute {
  type: RouteType.IbcNativeToHypNative;
}

export type Route = HypRoute | IbcRoute;

export type RoutesMap = Record<ChainCaip2Id, Record<ChainCaip2Id, Route[]>>;
