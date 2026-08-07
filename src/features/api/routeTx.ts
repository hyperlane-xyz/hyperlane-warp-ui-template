import type { RouteResponse, RouteTx } from './types';

export function getRouteTxs(route: RouteResponse): RouteTx[] {
  return route.txs?.length ? route.txs : route.tx ? [route.tx] : [];
}

export function isChainRouteTx(tx: RouteTx): tx is Extract<RouteTx, { to: string }> {
  return 'to' in tx;
}
