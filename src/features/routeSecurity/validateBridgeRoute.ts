import type { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';

import type { QuoteBridgeStep, RouteResponse } from '../api/types';
import {
  getTrustedWarpRoute,
  type TrustedWarpRoute,
  type TrustedWarpRouteMap,
  type TrustedWarpRouteToken,
} from './trustedWarpRoutes';

const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export type BridgeRouteValidationResult =
  | { valid: true }
  | { valid: false; reason: string; warpRouteId?: string };

export interface BridgeRouteValidationContext {
  chainMetadata: ChainMap<ChainMetadata>;
  trustedWarpRoutes: TrustedWarpRouteMap;
  srcToken?: string;
  dstToken?: string;
}

export function validateBridgeOnlyRoute(
  route: RouteResponse,
  context: BridgeRouteValidationContext,
): BridgeRouteValidationResult {
  if (!isBridgeOnlyRoute(route)) return { valid: true };

  if (route.steps.length !== 1) {
    return { valid: false, reason: 'Bridge-only route must contain exactly one bridge step' };
  }

  const step = route.steps[0];
  const warpRouteId = route.connection?.warpRouteId ?? step.warpRouteId;
  if (!warpRouteId) {
    return { valid: false, reason: 'Bridge-only route missing warpRouteId' };
  }
  if (
    route.connection?.warpRouteId &&
    step.warpRouteId &&
    route.connection.warpRouteId !== step.warpRouteId
  ) {
    return { valid: false, reason: 'Route and bridge step warpRouteId mismatch', warpRouteId };
  }

  const trustedRoute = getTrustedWarpRoute(context.trustedWarpRoutes, warpRouteId);
  if (!trustedRoute)
    return { valid: false, reason: 'Warp route missing from registry', warpRouteId };

  const originChainName = chainNameForSelector(context.chainMetadata, step.chain);
  const destinationChainName = chainNameForSelector(context.chainMetadata, step.destChain);
  if (!originChainName || !destinationChainName) {
    return {
      valid: false,
      reason: 'Bridge route chain missing from registry metadata',
      warpRouteId,
    };
  }

  const origin = tokenForChain(trustedRoute, originChainName);
  const destination = tokenForChain(trustedRoute, destinationChainName);
  if (!origin || !destination) {
    return { valid: false, reason: 'Warp route endpoint missing from registry', warpRouteId };
  }

  if (context.srcToken && !sameTokenAddress(context.srcToken, expectedDiscoveryToken(origin))) {
    return { valid: false, reason: 'Source token does not match registry route', warpRouteId };
  }
  if (
    context.dstToken &&
    !sameTokenAddress(context.dstToken, expectedDiscoveryToken(destination))
  ) {
    return { valid: false, reason: 'Destination token does not match registry route', warpRouteId };
  }

  if (!sameTokenAddress(step.router, origin.addressOrDenom)) {
    return { valid: false, reason: 'Bridge router does not match registry route', warpRouteId };
  }

  if (isNativeWarpStandard(origin.standard)) {
    if (!sameTokenAddress(step.asset, NATIVE_TOKEN)) {
      return { valid: false, reason: 'Native bridge asset must be native sentinel', warpRouteId };
    }
    if (route.approval) {
      return { valid: false, reason: 'Native bridge route must not request approval', warpRouteId };
    }
    return { valid: true };
  }

  const spendToken = expectedSpendToken(origin);
  if (!sameTokenAddress(step.asset, spendToken)) {
    return {
      valid: false,
      reason: 'Bridge asset does not match registry route token',
      warpRouteId,
    };
  }
  if (!route.approval) return { valid: true };

  if (!sameTokenAddress(route.approval.spender, origin.addressOrDenom)) {
    return { valid: false, reason: 'Approval spender does not match registry route', warpRouteId };
  }
  if (!sameTokenAddress(route.approval.token, spendToken)) {
    return { valid: false, reason: 'Approval token does not match registry route', warpRouteId };
  }

  return { valid: true };
}

export function isBridgeOnlyRoute(
  route: RouteResponse,
): route is RouteResponse & { steps: [QuoteBridgeStep, ...QuoteBridgeStep[]] } {
  return route.steps.length > 0 && route.steps.every((step) => step.type === 'bridge');
}

function chainNameForSelector(
  chainMetadata: ChainMap<ChainMetadata>,
  selector: number,
): string | undefined {
  return Object.entries(chainMetadata).find(([, metadata]) => metadata.domainId === selector)?.[0];
}

function tokenForChain(
  route: TrustedWarpRoute,
  chainName: string,
): TrustedWarpRouteToken | undefined {
  return route.tokens.find((token) => token.chainName === chainName);
}

function expectedSpendToken(token: TrustedWarpRouteToken): string {
  return token.collateralAddressOrDenom ?? token.addressOrDenom;
}

function expectedDiscoveryToken(token: TrustedWarpRouteToken): string {
  return isNativeWarpStandard(token.standard) ? NATIVE_TOKEN : expectedSpendToken(token);
}

function isNativeWarpStandard(standard: string): boolean {
  return standard.endsWith('HypNative');
}

function sameTokenAddress(left: string, right: string): boolean {
  if (EVM_ADDRESS.test(left) && EVM_ADDRESS.test(right)) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}
