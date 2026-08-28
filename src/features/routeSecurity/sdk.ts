import { ProtocolType } from '@hyperlane-xyz/utils';
import { decodeFunctionData, erc20Abi, type Hex } from 'viem';

import type { RouteResponse, RouteTx } from '../api/types';
import type { RouteSecurityValidationResult } from './types';
import { firstBridge, sameTokenAddress } from './utils';

const SDK_APPROVAL_CATEGORY = 'approval';
const SDK_REVOKE_CATEGORY = 'revoke';
const SDK_TRANSFER_CATEGORY = 'transfer';

export function validateSdkRouteTx(
  route: RouteResponse,
  tx: Extract<RouteTx, { protocol: string }>,
  srcProtocol: ProtocolType,
): RouteSecurityValidationResult {
  if (route.executionKind !== 'sdkWarp') {
    return { valid: false, reason: 'SDK transaction shape is only supported for sdkWarp routes' };
  }

  if (!sameProtocol(tx.protocol, srcProtocol)) {
    return { valid: false, reason: 'SDK transaction protocol does not match source chain' };
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

  if (tx.category === SDK_APPROVAL_CATEGORY || tx.category === SDK_REVOKE_CATEGORY) {
    return validateSdkApprovalTx(route, tx);
  }

  if (tx.category !== SDK_TRANSFER_CATEGORY) {
    return { valid: false, reason: 'SDK transaction category is not supported' };
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

function validateSdkApprovalTx(
  route: RouteResponse,
  tx: Extract<RouteTx, { protocol: string }>,
): RouteSecurityValidationResult {
  const bridge = firstBridge(route);
  if (!bridge) return { valid: false, reason: 'SDK approval transaction missing bridge step' };

  const approval = decodeEvmApproval(tx.transaction);
  if (!approval) return { valid: false, reason: 'SDK approval transaction is not supported' };

  if (!sameTokenAddress(approval.token, bridge.asset)) {
    return { valid: false, reason: 'SDK approval token does not match route input token' };
  }
  if (!sameTokenAddress(approval.spender, bridge.router)) {
    return { valid: false, reason: 'SDK approval spender does not match bridge router' };
  }

  const amountIn = parseAmount(bridge.amountIn);
  if (amountIn == null) {
    return { valid: false, reason: 'SDK approval amount does not match route input amount' };
  }
  if (tx.category === SDK_REVOKE_CATEGORY) {
    if (approval.amount !== 0n) {
      return { valid: false, reason: 'SDK revoke amount must be zero' };
    }
    return { valid: true };
  }
  if (approval.amount !== amountIn) {
    return { valid: false, reason: 'SDK approval amount does not match route input amount' };
  }

  return { valid: true };
}

function decodeEvmApproval(
  transaction: unknown,
): { token: string; spender: string; amount: bigint } | undefined {
  if (!isRecord(transaction)) return undefined;
  if (typeof transaction.to !== 'string' || typeof transaction.data !== 'string') return undefined;

  try {
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: transaction.data as Hex,
    });
    if (decoded.functionName !== 'approve') return undefined;
    const [spender, amount] = decoded.args;
    return { token: transaction.to, spender, amount };
  } catch {
    return undefined;
  }
}

function sdkTransactionTarget(transaction: unknown): string | undefined {
  if (!isRecord(transaction)) return undefined;
  if (typeof transaction.to === 'string') return transaction.to;
  if (typeof transaction.contractAddress === 'string') return transaction.contractAddress;
  return undefined;
}

function sameProtocol(left: string, right: ProtocolType): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function parseAmount(amount: string): bigint | null {
  try {
    return BigInt(amount);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
