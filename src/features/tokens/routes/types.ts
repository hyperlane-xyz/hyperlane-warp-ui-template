export enum RouteType {
  BaseToSynthetic = 'baseToSynthetic',
  SyntheticToSynthetic = 'syntheticToSynthetic',
  SyntheticToBase = 'syntheticToBase',
}

export interface Route {
  type: RouteType;
  baseCaip2Id: Caip2Id;
  baseTokenAddress: Address; // i.e. the underlying 'collateralized' token
  baseRouterAddress: Address;
  originCaip2Id: Caip2Id;
  originRouterAddress: Address;
  destCaip2Id: Caip2Id;
  destRouterAddress: Address;
  decimals: number;
  isNft: boolean;
}

export type RoutesMap = Record<Caip2Id, Record<Caip2Id, Route[]>>;
