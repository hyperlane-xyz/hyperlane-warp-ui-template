import { ProtocolType } from '@hyperlane-xyz/utils';

import type { RouteResponse, RouteTx } from '../api/types';
import type { RouteSecurityValidationResult } from './types';
import { firstBridge, sameTokenAddress } from './utils';

export function validateSdkRouteTx(
  route: RouteResponse,
  tx: Extract<RouteTx, { protocol: string }>,
  srcProtocol: ProtocolType,
): RouteSecurityValidationResult {
  if (route.executionKind !== 'sdkWarp') {
    return { valid: false, reason: 'SDK transaction shape is only supported for sdkWarp routes' };
  }

  if (tx.protocol !== srcProtocol) {
    return { valid: false, reason: 'SDK transaction protocol does not match source chain' };
  }

  if (tx.category !== 'transfer') {
    return { valid: false, reason: 'SDK transaction category is not transfer' };
  }

  const warpRouteId = route.connection?.warpRouteId ?? firstBridge(route)?.warpRouteId;
  if (!warpRouteId) return { valid: false, reason: 'SDK transaction missing warpRouteId' };
  if (tx.metadata?.warpRouteId !== warpRouteId) {
    return {
      valid: false,
      reason: 'SDK transaction warpRouteId does not match route',
      warpRouteId,
    };
  }

  const txTarget = sdkTransactionTarget(tx.transaction);
  const bridge = firstBridge(route);
  // Opaque SDK transaction shapes remain unpinned until we have a trusted,
  // protocol-specific way to extract their invoked target.
  if (txTarget && bridge && !sameTokenAddress(txTarget, bridge.router)) {
    return { valid: false, reason: 'SDK transaction target does not match bridge router' };
  }

  return { valid: true };
}

function sdkTransactionTarget(transaction: unknown): string | undefined {
  if (!isRecord(transaction)) return undefined;
  if (typeof transaction.to === 'string') return transaction.to;
  if (typeof transaction.contractAddress === 'string') return transaction.contractAddress;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
