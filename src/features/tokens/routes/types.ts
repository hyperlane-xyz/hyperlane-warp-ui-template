export enum RouteType {
  BaseToSynthetic = 'baseToSynthetic',
  SyntheticToSynthetic = 'syntheticToSynthetic',
  SyntheticToBase = 'syntheticToBase',
}

export interface Route {
  type: RouteType;
  baseTokenCaip19Id: TokenCaip19Id; // i.e. the underlying 'collateralized' token
  baseRouterAddress: Address;
  originCaip2Id: ChainCaip2Id;
  originRouterAddress: Address;
  originDecimals: number;
  destCaip2Id: ChainCaip2Id;
  destRouterAddress: Address;
  destDecimals: number;
}

export type RoutesMap = Record<ChainCaip2Id, Record<ChainCaip2Id, Route[]>>;
