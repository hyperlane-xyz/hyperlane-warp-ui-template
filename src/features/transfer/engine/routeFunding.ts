import { isEVMLike, ProtocolType } from '@hyperlane-xyz/utils';

import { getRouteTxs, isChainRouteTx } from '../../api/routeTx';
import type { RouteResponse } from '../../api/types';
import { tokenKey } from '../../tokens/utils';

export const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface SourceFunding {
  amountIn: bigint;
  externalFees: Map<string, bigint>;
  sourceTokenRequired: bigint;
  nativeRequired: bigint;
}

// Describes what the source wallet must fund before its local transaction fee.
// Fees embedded in amountIn are excluded; independently funded fees are grouped
// by chain and token so different assets are never summed together.
export function getSourceFunding({
  route,
  originChainId,
  originProtocol,
  sourceTokenAddress,
  sourceTokenIsNative,
  fallbackAmountIn,
}: {
  route: RouteResponse;
  originChainId: number;
  originProtocol: ProtocolType;
  sourceTokenAddress: string;
  sourceTokenIsNative: boolean;
  fallbackAmountIn: bigint;
}): SourceFunding {
  const initialStep = route.steps[0];
  const amountIn = initialStep ? BigInt(initialStep.amountIn) : fallbackAmountIn;
  const externalFees = getExternalFees(route, originProtocol);
  const sourceTokenFee = externalFees.get(feeKey(originChainId, sourceTokenAddress)) ?? 0n;
  const nativeFee = externalFees.get(feeKey(originChainId, NATIVE_ADDRESS)) ?? 0n;
  const sourceTokenRequired = amountIn + sourceTokenFee;
  const quotedNativeRequired = sourceTokenIsNative ? sourceTokenRequired : nativeFee;
  const transactionValue = getOriginTransactionValue(route);

  return {
    amountIn,
    externalFees,
    sourceTokenRequired,
    nativeRequired:
      transactionValue > quotedNativeRequired ? transactionValue : quotedNativeRequired,
  };
}

export function feeKey(chainId: number, tokenAddress: string): string {
  return tokenKey(chainId, tokenAddress);
}

export function isNativeAddress(address: string): boolean {
  return /^0x0+$/i.test(address);
}

function getOriginTransactionValue(route: RouteResponse): bigint {
  return getRouteTxs(route).reduce(
    (total, tx) => total + (isChainRouteTx(tx) ? BigInt(tx.value) : 0n),
    0n,
  );
}

function getExternalFees(route: RouteResponse, originProtocol: ProtocolType): Map<string, bigint> {
  const fees = new Map<string, bigint>();
  for (const step of route.steps) {
    if (step.type !== 'bridge') continue;

    if (!isIgpIncludedInAmountIn(step, originProtocol)) {
      addFee(fees, step.chain, step.fee.igpToken, BigInt(step.fee.igpAmount));
    }
    addFee(fees, step.chain, NATIVE_ADDRESS, BigInt(step.fee.localNativeFee));
  }
  return fees;
}

function isIgpIncludedInAmountIn(
  step: Extract<RouteResponse['steps'][number], { type: 'bridge' }>,
  originProtocol: ProtocolType,
): boolean {
  if (step.fee.igpIncludedInAmountIn != null) return step.fee.igpIncludedInAmountIn;

  const igpKey = feeKey(step.chain, step.fee.igpToken);
  const matchesAsset = feeKey(step.chain, step.asset) === igpKey;
  const matchesNonNativeRouter =
    !isNativeAddress(step.asset) && feeKey(step.chain, step.router) === igpKey;
  if (!matchesAsset && !matchesNonNativeRouter) return false;

  // Backward-compatible inference for engine versions without the explicit field.
  return !isNativeAddress(step.asset) || isEVMLike(originProtocol);
}

function addFee(
  fees: Map<string, bigint>,
  chainId: number,
  tokenAddress: string,
  amount: bigint,
): void {
  if (amount <= 0n) return;
  const key = feeKey(chainId, tokenAddress);
  fees.set(key, (fees.get(key) ?? 0n) + amount);
}
