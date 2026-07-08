import type { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';

import type { ChainDiscovery, QuoteBridgeStep, RouteApproval, RouteResponse } from '../api/types';
import {
  getRegistryWarpRoute,
  type RegistryWarpRoute,
  type RegistryWarpRouteMap,
  type RegistryWarpRouteToken,
} from '../warpRoutes/registryWarpRoutes';
import { chainForId, ENGINE_NATIVE_TOKEN_SENTINEL, sameTokenAddress } from './utils';

const HYP_NATIVE_STANDARDS = new Set([
  'EvmHypNative',
  'SealevelHypNative',
  'CwHypNative',
  'StarknetHypNative',
  'AleoHypNative',
  'TronHypNative',
]);

export type WarpRouteValidationResult =
  | { valid: true }
  | { valid: false; reason: string; warpRouteId?: string };

export interface WarpRouteValidationContext {
  chainMetadata: ChainMap<ChainMetadata>;
  registryWarpRoutes: RegistryWarpRouteMap;
  chains?: ChainDiscovery[];
  srcToken?: string;
  dstToken?: string;
}

export function validateWarpRoute(
  route: RouteResponse,
  context: WarpRouteValidationContext,
): WarpRouteValidationResult {
  if (!isBridgeOnlyRoute(route)) return { valid: true };

  if (route.steps.length !== 1) {
    // The engine currently emits direct bridge routes as a single bridge step.
    // Multi-hop bridge-only paths need explicit per-hop registry validation before we allow them.
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

  const registryRoute = getRegistryWarpRoute(context.registryWarpRoutes, warpRouteId);
  if (!registryRoute)
    return { valid: false, reason: 'Warp route missing from registry', warpRouteId };

  const originChain = chainForId(context.chains, step.chain);
  const destinationChain = chainForId(context.chains, step.destChain);
  const originChainName =
    originChain?.chainName ?? chainNameForChainId(context.chainMetadata, step.chain);
  const destinationChainName =
    destinationChain?.chainName ?? chainNameForChainId(context.chainMetadata, step.destChain);
  if (!originChainName || !destinationChainName) {
    return {
      valid: false,
      reason: 'Bridge route chain missing from registry metadata',
      warpRouteId,
    };
  }

  const origin = tokenForChain(registryRoute, originChainName);
  const destination = tokenForChain(registryRoute, destinationChainName);
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
    if (!sameTokenAddress(step.asset, ENGINE_NATIVE_TOKEN_SENTINEL)) {
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

  if (!sameTokenAddress(route.approval.token, spendToken)) {
    return { valid: false, reason: 'Approval token does not match registry route', warpRouteId };
  }

  return validateApprovalSpender(route, route.approval, origin, originChain, warpRouteId);
}

export function isBridgeOnlyRoute(
  route: RouteResponse,
): route is RouteResponse & { steps: [QuoteBridgeStep, ...QuoteBridgeStep[]] } {
  return route.steps.length > 0 && route.steps.every((step) => step.type === 'bridge');
}

function chainNameForChainId(
  chainMetadata: ChainMap<ChainMetadata>,
  chainId: number,
): string | undefined {
  return Object.entries(chainMetadata).find(([, metadata]) => metadata.chainId === chainId)?.[0];
}

function tokenForChain(
  route: RegistryWarpRoute,
  chainName: string,
): RegistryWarpRouteToken | undefined {
  return route.tokens.find((token) => token.chainName === chainName);
}

function expectedSpendToken(token: RegistryWarpRouteToken): string {
  return token.collateralAddressOrDenom ?? token.addressOrDenom;
}

function expectedDiscoveryToken(token: RegistryWarpRouteToken): string {
  return isNativeWarpStandard(token.standard)
    ? ENGINE_NATIVE_TOKEN_SENTINEL
    : expectedSpendToken(token);
}

function isNativeWarpStandard(standard: string): boolean {
  return HYP_NATIVE_STANDARDS.has(standard);
}

function validateApprovalSpender(
  route: RouteResponse,
  approval: RouteApproval,
  origin: RegistryWarpRouteToken,
  originChain: ChainDiscovery | undefined,
  warpRouteId: string,
): WarpRouteValidationResult {
  if (approval.kind === 'permit2') {
    if (route.executionKind !== 'universalRouter') {
      return { valid: false, reason: 'Permit2 approval requires universal router', warpRouteId };
    }
    if (!originChain?.permit2 || !originChain.universalRouter || !approval.permit2Spender) {
      return { valid: false, reason: 'Permit2 approval missing chain contracts', warpRouteId };
    }
    if (!sameTokenAddress(approval.spender, originChain.permit2)) {
      return {
        valid: false,
        reason: 'Permit2 approval spender does not match chain Permit2',
        warpRouteId,
      };
    }
    if (!sameTokenAddress(approval.permit2Spender, originChain.universalRouter)) {
      return {
        valid: false,
        reason: 'Permit2 approval target does not match chain universal router',
        warpRouteId,
      };
    }
    return { valid: true };
  }

  if (route.executionKind === 'universalRouter') {
    if (!originChain?.universalRouter) {
      return { valid: false, reason: 'Universal router approval target unavailable', warpRouteId };
    }
    if (!sameTokenAddress(approval.spender, originChain.universalRouter)) {
      return {
        valid: false,
        reason: 'Approval spender does not match chain universal router',
        warpRouteId,
      };
    }
    return { valid: true };
  }

  if (!sameTokenAddress(approval.spender, origin.addressOrDenom)) {
    return { valid: false, reason: 'Approval spender does not match registry route', warpRouteId };
  }
  return { valid: true };
}
