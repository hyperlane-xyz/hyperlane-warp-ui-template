import { isEVMLike, ProtocolType } from '@hyperlane-xyz/utils';

import { getRouteTxs, isChainRouteTx } from '../api/routeTx';
import type { ChainDiscovery, QuoteStep, RouteResponse, RouteTx } from '../api/types';
import { isTrustedWrappedNativeAddress } from '../tokens/wrappedNative';
import { trustedUniversalRouterForChain } from './chainContracts';
import { validateSdkRouteTx } from './sdk';
import { validateSealevelRouteTx } from './svm';
import type { RouteSecurityValidationFailure, RouteSecurityValidationResult } from './types';
import {
  chainForId,
  firstBridge,
  isEngineNativeToken,
  isUnsetAddress,
  sameTokenAddress,
} from './utils';
import { validateWarpRoute, type WarpRouteValidationContext } from './validateWarpRoute';

export interface RouteSecurityValidationContext extends WarpRouteValidationContext {
  srcChain: number;
  dstChain: number;
  srcTokenWrappedAddress?: string;
  dstTokenWrappedAddress?: string;
}

export function validateRouteSecurity(
  route: RouteResponse,
  context: RouteSecurityValidationContext,
): RouteSecurityValidationResult {
  const warpRouteValidation = validateWarpRoute(route, context);
  if (!warpRouteValidation.valid) return warpRouteValidation;

  const chainPathValidation = validateChainPath(route, context.srcChain, context.dstChain);
  if (!chainPathValidation.valid) return chainPathValidation;

  const stepBindingValidation = validateStepBindings(route, context);
  if (!stepBindingValidation.valid) return stepBindingValidation;

  const approvalValidation = validateApproval(route, context);
  if (!approvalValidation.valid) return approvalValidation;

  return validateTxTargets(route, context);
}

function validateChainPath(
  route: RouteResponse,
  srcChain: number,
  dstChain: number,
): RouteSecurityValidationResult {
  if (route.steps.length === 0) {
    return { valid: false, reason: 'Route has no steps' };
  }

  let currentChain = srcChain;
  for (const step of route.steps) {
    if (step.chain !== currentChain) {
      return { valid: false, reason: 'Route step chain does not match expected path' };
    }
    if (step.type === 'bridge') currentChain = step.destChain;
  }

  if (currentChain !== dstChain) {
    return { valid: false, reason: 'Route destination does not match request destination' };
  }

  return { valid: true };
}

function validateStepBindings(
  route: RouteResponse,
  context: RouteSecurityValidationContext,
): RouteSecurityValidationResult {
  const firstStep = route.steps[0];
  if (!firstStep) return { valid: false, reason: 'Route has no steps' };
  if (
    context.srcToken &&
    !sameRequestedToken(
      inputTokenForStep(firstStep),
      context.srcToken,
      context.srcTokenWrappedAddress,
    )
  ) {
    return { valid: false, reason: 'Route input token does not match request' };
  }

  const finalStep = route.steps[route.steps.length - 1];
  if (
    context.dstToken &&
    finalStep.type === 'swap' &&
    !sameRequestedToken(finalStep.tokenOut, context.dstToken, context.dstTokenWrappedAddress)
  ) {
    return { valid: false, reason: 'Route output token does not match request' };
  }

  for (let i = 0; i < route.steps.length - 1; i++) {
    const current = route.steps[i];
    const next = route.steps[i + 1];
    if (current.amountOut !== next.amountIn) {
      return { valid: false, reason: 'Route step amounts are discontinuous' };
    }
    if (
      current.type === 'swap' &&
      !sameAdjacentStepToken(current.tokenOut, next, route.executionKind)
    ) {
      return { valid: false, reason: 'Route step tokens are discontinuous' };
    }
  }

  return { valid: true };
}

function validateApproval(
  route: RouteResponse,
  context: RouteSecurityValidationContext,
): RouteSecurityValidationResult {
  if (!route.approval) return { valid: true };
  const warpRouteId = route.connection?.warpRouteId ?? firstBridge(route)?.warpRouteId;

  // validateWarpRoute handles bridge-only registry consistency; this pass
  // applies UI-level approval constraints to any approval object.
  if (route.approval.kind !== 'erc20') {
    return { valid: false, reason: 'Permit2 approvals are not supported by this UI' };
  }

  const firstStep = route.steps[0];
  if (!firstStep) return { valid: false, reason: 'Approval route has no spend step' };

  const spendToken = spendTokenForStep(firstStep);
  if (
    isEngineNativeToken(spendToken) ||
    sameNativeRequestWrappedToken(spendToken, context.srcToken, context.srcTokenWrappedAddress)
  ) {
    return { valid: false, reason: 'Native route must not request approval' };
  }
  if (!sameTokenAddress(route.approval.token, spendToken)) {
    return { valid: false, reason: 'Approval token does not match route input token' };
  }

  const approvalAmount = parseRouteAmount(route.approval.amount);
  const spendAmount = parseRouteAmount(firstStep.amountIn);
  if (approvalAmount == null || spendAmount == null) {
    return { valid: false, reason: 'Approval route has invalid amount' };
  }

  if (approvalAmount > spendAmount) {
    return { valid: false, reason: 'Approval amount exceeds route input amount' };
  }
  if (approvalAmount < spendAmount) {
    return { valid: false, reason: 'Approval amount is below route input amount' };
  }

  if (route.executionKind === 'sdkWarp') {
    return { valid: false, reason: 'SDK warp route must not request approval' };
  }

  if (route.executionKind === 'universalRouter') {
    const srcChain = chainForId(context.chains, context.srcChain);
    const trustedUniversalRouter = trustedUniversalRouterForChain({
      chain: srcChain,
      chainAddresses: srcChain?.chainName
        ? context.chainAddresses?.[srcChain.chainName]
        : undefined,
      unavailableReason: 'Universal router approval target unavailable',
      mismatchReason: 'Chain universal router does not match registry',
      warpRouteId,
    });
    if (!trustedUniversalRouter.valid) return trustedUniversalRouter;
    if (!sameTokenAddress(route.approval.spender, trustedUniversalRouter.universalRouter)) {
      return {
        valid: false,
        reason: 'Approval spender does not match chain universal router',
        warpRouteId,
      };
    }
    return { valid: true };
  }

  const firstBridgeStep = firstBridge(route);
  if (!firstBridgeStep) {
    return { valid: false, reason: 'Direct warp approval route has no bridge step' };
  }
  if (!sameTokenAddress(route.approval.spender, firstBridgeStep.router)) {
    return { valid: false, reason: 'Approval spender does not match bridge router' };
  }

  return { valid: true };
}

function validateTxTargets(
  route: RouteResponse,
  context: RouteSecurityValidationContext,
): RouteSecurityValidationResult {
  const txs = getRouteTxs(route);
  if (txs.length === 0) return { valid: false, reason: 'Route has no transactions' };

  if (route.executionKind === 'sdkWarp') {
    const txOrderValidation = validateSdkTxOrder(txs);
    if (!txOrderValidation.valid) return txOrderValidation;
  }

  const srcChain = chainForId(context.chains, context.srcChain);
  if (!srcChain) return { valid: false, reason: 'Route source chain unavailable' };

  const srcProtocol = protocolForChain(srcChain);
  if (!srcProtocol) return { valid: false, reason: 'Route source protocol unavailable' };

  for (const tx of txs) {
    const validation = isChainRouteTx(tx)
      ? validateChainRouteTx(route, tx, srcChain, srcProtocol, context)
      : validateSdkRouteTx(route, tx, srcProtocol);
    if (!validation.valid) return validation;
  }

  return { valid: true };
}

function validateSdkTxOrder(txs: RouteTx[]): RouteSecurityValidationResult {
  const categories = txs.map((tx) => (isChainRouteTx(tx) ? 'chain' : tx.category));
  const transferIndexes = categories.flatMap((category, index) =>
    category === 'transfer' ? [index] : [],
  );
  if (transferIndexes.length === 0) {
    return { valid: false, reason: 'SDK route missing transfer transaction' };
  }
  if (transferIndexes.length > 1) {
    return { valid: false, reason: 'SDK route has multiple transfer transactions' };
  }
  if (transferIndexes[0] !== categories.length - 1) {
    return { valid: false, reason: 'SDK transfer transaction must be last' };
  }

  const preTransfer = categories.slice(0, -1);
  const revokeIndex = preTransfer.indexOf('revoke');
  const approvalIndex = preTransfer.indexOf('approval');
  if (preTransfer.some((category) => category !== 'revoke' && category !== 'approval')) {
    return { valid: false, reason: 'SDK transaction category is not supported' };
  }
  if (preTransfer.filter((category) => category === 'revoke').length > 1) {
    return { valid: false, reason: 'SDK route has multiple revoke transactions' };
  }
  if (preTransfer.filter((category) => category === 'approval').length > 1) {
    return { valid: false, reason: 'SDK route has multiple approval transactions' };
  }
  if (revokeIndex >= 0 && approvalIndex >= 0 && revokeIndex > approvalIndex) {
    return { valid: false, reason: 'SDK revoke transaction must precede approval' };
  }
  return { valid: true };
}

function validateChainRouteTx(
  route: RouteResponse,
  tx: Extract<RouteTx, { to: string }>,
  srcChain: ChainDiscovery,
  srcProtocol: ProtocolType,
  context: RouteSecurityValidationContext,
): RouteSecurityValidationResult {
  if (isEVMLike(srcProtocol)) {
    const expectedTarget = expectedChainTxTarget(route, srcChain, context);
    if (!expectedTarget.valid) return expectedTarget;
    if (!sameTokenAddress(tx.to, expectedTarget.target)) {
      return { valid: false, reason: 'EVM transaction target does not match route executor' };
    }
    return { valid: true };
  }

  if (srcProtocol === ProtocolType.Sealevel) {
    if (route.executionKind !== 'universalRouter') {
      return {
        valid: false,
        reason: 'Sealevel chain transaction is only supported for universal router execution',
      };
    }
    const trustedUniversalRouter = trustedUniversalRouterForChain({
      chain: srcChain,
      chainAddresses: context.chainAddresses?.[srcChain.chainName],
      unavailableReason: 'Sealevel universal router program unavailable',
      mismatchReason: 'Chain universal router does not match registry',
    });
    if (!trustedUniversalRouter.valid) return trustedUniversalRouter;
    return validateSealevelRouteTx(route, tx, trustedUniversalRouter.universalRouter);
  }

  return {
    valid: false,
    reason: 'Chain transaction shape is not supported for source protocol',
  };
}

function expectedChainTxTarget(
  route: RouteResponse,
  srcChain: ChainDiscovery,
  context: RouteSecurityValidationContext,
): RouteSecurityValidationFailure | { valid: true; target: string } {
  const warpRouteId = route.connection?.warpRouteId ?? firstBridge(route)?.warpRouteId;

  if (route.executionKind === 'universalRouter') {
    const trustedUniversalRouter = trustedUniversalRouterForChain({
      chain: srcChain,
      chainAddresses: context.chainAddresses?.[srcChain.chainName],
      unavailableReason: 'EVM transaction target unavailable',
      mismatchReason: 'Chain universal router does not match registry',
      warpRouteId,
    });
    if (!trustedUniversalRouter.valid) return trustedUniversalRouter;
    return { valid: true, target: trustedUniversalRouter.universalRouter };
  }

  if (route.executionKind === 'warpDirect') {
    const expectedTarget = firstBridge(route)?.router;
    if (!expectedTarget || isUnsetAddress(expectedTarget)) {
      return { valid: false, reason: 'EVM transaction target unavailable', warpRouteId };
    }
    return { valid: true, target: expectedTarget };
  }

  return { valid: false, reason: 'EVM transaction target unavailable', warpRouteId };
}

function spendTokenForStep(step: QuoteStep): string {
  return step.type === 'swap' ? step.tokenIn : step.asset;
}

function inputTokenForStep(step: QuoteStep): string {
  return step.type === 'swap' ? step.tokenIn : step.asset;
}

function sameAdjacentStepToken(
  outputToken: string,
  nextStep: QuoteStep,
  executionKind: RouteResponse['executionKind'],
): boolean {
  if (sameTokenAddress(outputToken, inputTokenForStep(nextStep))) return true;
  return (
    executionKind === 'universalRouter' &&
    nextStep.type === 'bridge' &&
    isEngineNativeToken(nextStep.asset) &&
    isTrustedWrappedNativeAddress(nextStep.chain, outputToken)
  );
}

function sameRequestedToken(
  routeToken: string,
  requestToken: string,
  requestTokenWrappedAddress: string | undefined,
): boolean {
  if (sameTokenAddress(routeToken, requestToken)) return true;
  return sameNativeRequestWrappedToken(routeToken, requestToken, requestTokenWrappedAddress);
}

function sameNativeRequestWrappedToken(
  routeToken: string,
  requestToken: string | undefined,
  requestTokenWrappedAddress: string | undefined,
): boolean {
  return (
    !!requestToken &&
    !!requestTokenWrappedAddress &&
    isEngineNativeToken(requestToken) &&
    sameTokenAddress(routeToken, requestTokenWrappedAddress)
  );
}

function parseRouteAmount(amount: string): bigint | null {
  try {
    return BigInt(amount);
  } catch {
    return null;
  }
}

function protocolForChain(chain: ChainDiscovery | undefined): ProtocolType | undefined {
  if (!chain) return undefined;
  const protocol = chain.protocol.toLowerCase();
  return Object.values(ProtocolType).find((value) => value.toLowerCase() === protocol);
}
