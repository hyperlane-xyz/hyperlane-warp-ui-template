import type { ChainAddresses } from '@hyperlane-xyz/registry';
import {
  PROTOCOL_TO_HYP_NATIVE_STANDARD,
  TokenStandard,
  type ChainMap,
  type ChainMetadata,
} from '@hyperlane-xyz/sdk';

import type { ChainDiscovery, QuoteBridgeStep, RouteApproval, RouteResponse } from '../api/types';
import { isTrustedWrappedNativeAddress } from '../tokens/wrappedNative';
import {
  getRegistryWarpRoute,
  type RegistryWarpRoute,
  type RegistryWarpRouteMap,
  type RegistryWarpRouteToken,
} from '../warpRoutes/registryWarpRoutes';
import { trustedUniversalRouterForChain } from './chainContracts';
import { chainForId, ENGINE_NATIVE_TOKEN_SENTINEL, sameTokenAddress } from './utils';

const HYP_NATIVE_STANDARDS = new Set([
  'EvmHypNative',
  'SealevelHypNative',
  'CwHypNative',
  'StarknetHypNative',
  'AleoHypNative',
  'TronHypNative',
]);
const ADDRESS_OR_DENOM_SPEND_STANDARDS = new Set([
  TokenStandard.EvmHypSynthetic,
  TokenStandard.EvmHypSyntheticRebase,
  TokenStandard.EvmHypXERC20,
  TokenStandard.EvmHypXERC20Lockbox,
  TokenStandard.EvmHypVSXERC20,
  TokenStandard.EvmHypVSXERC20Lockbox,
  TokenStandard.TronHypSynthetic,
  TokenStandard.TronHypSyntheticRebase,
  TokenStandard.TronHypXERC20,
  TokenStandard.TronHypXERC20Lockbox,
  TokenStandard.TronHypVSXERC20,
  TokenStandard.TronHypVSXERC20Lockbox,
  TokenStandard.SealevelHypSynthetic,
  TokenStandard.CwHypSynthetic,
  TokenStandard.CosmNativeHypSynthetic, // SDK key is abbreviated; enum value is "CosmosNativeHypSynthetic".
  TokenStandard.StarknetHypSynthetic,
  TokenStandard.RadixHypSynthetic,
  TokenStandard.AleoHypSynthetic,
]);
// PROTOCOL_TO_HYP_NATIVE_STANDARD maps some native protocols, such as
// CosmosNative and Radix, to collateral-style standards. After removing true
// *HypNative standards, the remaining entries spend the protocol native token.
const PROTOCOL_NATIVE_COLLATERAL_STANDARDS: ReadonlySet<string> = new Set(
  Object.values(PROTOCOL_TO_HYP_NATIVE_STANDARD).filter(
    (standard) => !isNativeWarpStandard(standard),
  ),
);

export type WarpRouteValidationResult =
  | { valid: true }
  | { valid: false; reason: string; warpRouteId?: string };

export interface WarpRouteValidationContext {
  chainMetadata: ChainMap<ChainMetadata>;
  chainAddresses?: ChainMap<ChainAddresses>;
  registryWarpRoutes: RegistryWarpRouteMap;
  chains?: ChainDiscovery[];
  srcToken?: string;
  dstToken?: string;
}

export function validateWarpRoute(
  route: RouteResponse,
  context: WarpRouteValidationContext,
): WarpRouteValidationResult {
  const bridgeSteps = route.steps.filter((step): step is QuoteBridgeStep => step.type === 'bridge');
  if (!bridgeSteps.length) return { valid: true };

  const isBridgeOnly = isBridgeOnlyRoute(route);
  if (isBridgeOnly && route.steps.length !== 1) {
    // The engine currently emits direct bridge routes as a single bridge step.
    // Multi-hop bridge-only paths need explicit per-hop registry validation before we allow them.
    return { valid: false, reason: 'Bridge-only route must contain exactly one bridge step' };
  }

  for (const step of bridgeSteps) {
    const stepIndex = route.steps.indexOf(step);
    const previousStep = stepIndex > 0 ? route.steps[stepIndex - 1] : undefined;
    const nextStep = stepIndex < route.steps.length - 1 ? route.steps[stepIndex + 1] : undefined;
    const validation = validateBridgeStep(route, step, context, {
      sourceToken:
        route.steps[0] === step
          ? context.srcToken
          : previousStep?.type === 'swap'
            ? previousStep.tokenOut
            : undefined,
      destinationToken:
        route.steps[route.steps.length - 1] === step
          ? context.dstToken
          : nextStep?.type === 'swap'
            ? nextStep.tokenIn
            : undefined,
      allowWrappedSource:
        route.executionKind === 'universalRouter' && previousStep?.type === 'swap',
      allowWrappedDestination:
        route.executionKind === 'universalRouter' && nextStep?.type === 'swap',
      validateApproval: isBridgeOnly,
    });
    if (!validation.valid) return validation;
  }

  return { valid: true };
}

function validateBridgeStep(
  route: RouteResponse,
  step: QuoteBridgeStep,
  context: WarpRouteValidationContext,
  options: {
    sourceToken: string | undefined;
    destinationToken: string | undefined;
    allowWrappedSource: boolean;
    allowWrappedDestination: boolean;
    validateApproval: boolean;
  },
): WarpRouteValidationResult {
  const warpRouteId = route.connection?.warpRouteId ?? step.warpRouteId;
  if (!warpRouteId) {
    return { valid: false, reason: 'Bridge route missing warpRouteId' };
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

  const origin = originTokenForBridgeStep(registryRoute, originChainName, step);
  const destination = destinationTokenForContext(
    registryRoute,
    destinationChainName,
    options.destinationToken,
    step.destChain,
    options.allowWrappedDestination,
  );
  if (!origin || !destination) {
    return { valid: false, reason: 'Warp route endpoint missing from registry', warpRouteId };
  }

  if (
    options.sourceToken &&
    !matchesDiscoveryToken(options.sourceToken, origin, step.chain, options.allowWrappedSource)
  ) {
    return { valid: false, reason: 'Source token does not match registry route', warpRouteId };
  }
  if (
    options.destinationToken &&
    !matchesDiscoveryToken(
      options.destinationToken,
      destination,
      step.destChain,
      options.allowWrappedDestination,
    )
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
    if (options.validateApproval && route.approval) {
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
  if (!options.validateApproval || !route.approval) return { valid: true };

  if (!sameTokenAddress(route.approval.token, spendToken)) {
    return { valid: false, reason: 'Approval token does not match registry route', warpRouteId };
  }

  return validateApprovalSpender(
    route,
    route.approval,
    origin,
    originChain,
    context.chainAddresses?.[originChainName],
    warpRouteId,
  );
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

function tokensForChain(route: RegistryWarpRoute, chainName: string): RegistryWarpRouteToken[] {
  return route.tokens.filter((token) => token.chainName === chainName);
}

function originTokenForBridgeStep(
  route: RegistryWarpRoute,
  chainName: string,
  step: QuoteBridgeStep,
): RegistryWarpRouteToken | undefined {
  const candidates = tokensForChain(route, chainName);
  if (candidates.length <= 1) return candidates[0];
  return candidates.find((token) => sameTokenAddress(token.addressOrDenom, step.router));
}

function destinationTokenForContext(
  route: RegistryWarpRoute,
  chainName: string,
  dstToken: string | undefined,
  chainId: number,
  allowWrappedNative: boolean,
): RegistryWarpRouteToken | undefined {
  const candidates = tokensForChain(route, chainName);
  if (candidates.length <= 1) return candidates[0];
  if (!dstToken) return undefined;
  return candidates.find((token) =>
    matchesDiscoveryToken(dstToken, token, chainId, allowWrappedNative),
  );
}

function matchesDiscoveryToken(
  address: string,
  token: RegistryWarpRouteToken,
  chainId: number,
  allowWrappedNative: boolean,
): boolean {
  if (sameTokenAddress(address, expectedDiscoveryToken(token))) return true;
  return (
    allowWrappedNative &&
    isNativeWarpStandard(token.standard) &&
    isTrustedWrappedNativeAddress(chainId, address)
  );
}

function expectedSpendToken(token: RegistryWarpRouteToken): string {
  if (usesAddressOrDenomAsSpendToken(token.standard)) return token.addressOrDenom;
  if (PROTOCOL_NATIVE_COLLATERAL_STANDARDS.has(token.standard)) return ENGINE_NATIVE_TOKEN_SENTINEL;
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

function usesAddressOrDenomAsSpendToken(standard: string): boolean {
  return ADDRESS_OR_DENOM_SPEND_STANDARDS.has(standard as TokenStandard);
}

function validateApprovalSpender(
  route: RouteResponse,
  approval: RouteApproval,
  origin: RegistryWarpRouteToken,
  originChain: ChainDiscovery | undefined,
  originChainAddresses: ChainAddresses | undefined,
  warpRouteId: string,
): WarpRouteValidationResult {
  if (approval.kind === 'permit2') {
    if (route.executionKind !== 'universalRouter') {
      return { valid: false, reason: 'Permit2 approval requires universal router', warpRouteId };
    }
    const trustedUniversalRouter = trustedUniversalRouterForChain({
      chain: originChain,
      chainAddresses: originChainAddresses,
      unavailableReason: 'Permit2 approval missing chain contracts',
      mismatchReason: 'Chain universal router does not match registry',
      warpRouteId,
    });
    if (!trustedUniversalRouter.valid) return trustedUniversalRouter;
    if (!originChain?.permit2 || !approval.permit2Spender) {
      return { valid: false, reason: 'Permit2 approval missing chain contracts', warpRouteId };
    }
    if (!sameTokenAddress(approval.spender, originChain.permit2)) {
      return {
        valid: false,
        reason: 'Permit2 approval spender does not match chain Permit2',
        warpRouteId,
      };
    }
    if (!sameTokenAddress(approval.permit2Spender, trustedUniversalRouter.universalRouter)) {
      return {
        valid: false,
        reason: 'Permit2 approval target does not match chain universal router',
        warpRouteId,
      };
    }
    return { valid: true };
  }

  if (route.executionKind === 'universalRouter') {
    const trustedUniversalRouter = trustedUniversalRouterForChain({
      chain: originChain,
      chainAddresses: originChainAddresses,
      unavailableReason: 'Universal router approval target unavailable',
      mismatchReason: 'Chain universal router does not match registry',
      warpRouteId,
    });
    if (!trustedUniversalRouter.valid) return trustedUniversalRouter;
    if (!sameTokenAddress(approval.spender, trustedUniversalRouter.universalRouter)) {
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
