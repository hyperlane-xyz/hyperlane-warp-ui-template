export enum RouteType {
  CollateralToCollateral = 'collateralToCollateral',
  CollateralToSynthetic = 'collateralToSynthetic',
  SyntheticToSynthetic = 'syntheticToSynthetic',
  SyntheticToCollateral = 'syntheticToCollateral',
}

export interface Route {
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
  // Only set for CollateralToCollateral routes (b.c. sealevel need it)
  destTokenCaip19Id?: TokenCaip19Id;
}

export type RoutesMap = Record<ChainCaip2Id, Record<ChainCaip2Id, Route[]>>;
