import type { RouteResponse, RouteTx } from './types';

export interface EvmRouteTx {
  to: string;
  data: string;
  value: string;
}

export function getRouteTxs(route: RouteResponse): RouteTx[] {
  return route.txs?.length ? route.txs : route.tx ? [route.tx] : [];
}

export function isChainRouteTx(tx: RouteTx): tx is Extract<RouteTx, { to: string }> {
  return 'to' in tx;
}

// SDK EVM transactions wrap the executable request under `transaction`.
// Normalize both route shapes so balance preflight can estimate their real gas.
export function toEvmRouteTx(tx: RouteTx): EvmRouteTx | null {
  if (isChainRouteTx(tx)) {
    return { to: tx.to, data: tx.data, value: tx.value };
  }
  if (tx.protocol.toLowerCase() !== 'ethereum' || !isRecord(tx.transaction)) return null;

  const { to, data, value } = tx.transaction;
  if (typeof to !== 'string' || typeof data !== 'string') return null;
  if (value == null) return { to, data, value: '0' };
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return null;
  }
  return { to, data, value: value.toString() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
