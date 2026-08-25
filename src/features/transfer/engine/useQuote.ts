import { useTimeout } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { bytesToHex, parseUnits, type Hex } from 'viem';

import { logger } from '../../../utils/logger';
import { useChains } from '../../api/hooks';
import { routerClient } from '../../api/RouterClient';
import type { QuoteResponse, RouteResponse } from '../../api/types';
import { validateRouteSecurity } from '../../routeSecurity/validateRouteSecurity';
import { useStore } from '../../store';
import { useTokens } from '../../tokens/hooks';
import { tokenKey } from '../../tokens/utils';
import { validateWrappedNativeMetadata } from '../../tokens/wrappedNative';
import {
  resolveQuotedVaultCollateralTokens,
  type RegistryWarpRouteMap,
} from '../../warpRoutes/registryWarpRoutes';
import type {
  AugmentedQuote,
  AugmentedRoute,
  FeeBreakdown,
  FeeComponent,
  TransferFormValues,
} from './types';

// Random 32-byte hex via the browser's crypto API. Salt entropy is owned
// by the client so repeat senders don't produce linkable commitments.
function randomBytes32(): Hex {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

// 30s engine TTL — refresh 5s before to avoid expired-mid-sign races.
const REFRESH_MS = 25_000;
const QUOTE_RESOLUTION_SAFETY_MS = 5_000;
const QUOTE_RESOLUTION_ATTEMPTS = 2;

interface UseQuoteArgs {
  values: TransferFormValues;
  /** Sender from connected wallet — passed through as-is. */
  sender: string | undefined;
  /** Pause auto-refresh (e.g. wallet modal open or tx signing). */
  pause?: boolean;
}

interface QuoteQueryData {
  response: QuoteResponse;
  registryWarpRoutes: RegistryWarpRouteMap;
}

export function useQuote({ values, sender, pause }: UseQuoteArgs) {
  const [now, setNow] = useState(() => Date.now());
  const chainMetadata = useStore((state) => state.chainMetadata);
  const chainAddresses = useStore((state) => state.chainAddresses);
  const registryWarpRoutes = useStore((state) => state.registryWarpRoutes);
  const multiProvider = useStore((state) => state.multiProvider);
  const { data: chainsResp, isError: chainsError } = useChains();

  // Pass sender + recipient through as-is — engine handles per-protocol normalization.
  const engineSender = sender || undefined;
  const engineRecipient = values.recipient || undefined;

  const enabled = isQuoteRequestReady(values, engineSender) && !pause;

  const { data: srcTokens } = useTokens(values.srcChain != null ? { chain: values.srcChain } : {});
  const srcTokenInfo = srcTokens.find(
    (t) =>
      values.srcChain != null &&
      tokenKey(t.chainId, t.address) === tokenKey(values.srcChain, values.srcToken),
  );
  const { data: dstTokens } = useTokens(values.dstChain != null ? { chain: values.dstChain } : {});
  const dstTokenInfo = dstTokens.find(
    (t) =>
      values.dstChain != null &&
      tokenKey(t.chainId, t.address) === tokenKey(values.dstChain, values.dstToken),
  );
  const srcWrappedNativeMetadata = useMemo(
    () => validateWrappedNativeMetadata(srcTokenInfo),
    [srcTokenInfo],
  );
  const dstWrappedNativeMetadata = useMemo(
    () => validateWrappedNativeMetadata(dstTokenInfo),
    [dstTokenInfo],
  );
  const srcTokenWrappedAddress = srcWrappedNativeMetadata.valid
    ? srcWrappedNativeMetadata.trustedWrappedAddress
    : undefined;
  const dstTokenWrappedAddress = dstWrappedNativeMetadata.valid
    ? dstWrappedNativeMetadata.trustedWrappedAddress
    : undefined;

  const amountAtomic = useMemo(() => {
    if (!srcTokenInfo || srcTokenInfo.decimals == null) return null;
    if (values.amount === '' || values.amount == null) return null;
    try {
      return parseUnits(String(values.amount) as `${number}`, srcTokenInfo.decimals);
    } catch {
      return null;
    }
  }, [srcTokenInfo, values.amount]);

  // Salt is stable per transfer intent. Quote auto-refreshes share the same
  // salt; intent changes mint a fresh one.
  const commitmentSalt = useMemo(
    () => randomBytes32(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values.srcChain, values.dstChain, values.srcToken, values.dstToken],
  );

  const query = useQuery<QuoteQueryData>({
    queryKey: [
      'router',
      'quote',
      values.srcChain,
      values.dstChain,
      values.srcToken,
      values.dstToken,
      amountAtomic?.toString(),
      engineSender ?? null,
      engineRecipient ?? null,
      values.slippageBps,
    ],
    queryFn: async ({ signal }) => {
      const request = {
        srcChain: values.srcChain!,
        dstChain: values.dstChain!,
        srcToken: values.srcToken,
        dstToken: values.dstToken,
        amount: amountAtomic!,
        sender: engineSender!,
        recipient: engineRecipient,
        slippageBps: values.slippageBps,
        commitmentSalt,
      };
      for (let attempt = 0; attempt < QUOTE_RESOLUTION_ATTEMPTS; attempt++) {
        const response = await routerClient.quote(request, { signal });
        const resolvedRegistryWarpRoutes = await resolveQuotedVaultCollateralTokens(
          registryWarpRoutes,
          response.routes,
          multiProvider,
          signal,
        );
        if (isQuoteFreshAfterResolution(response.expiresAt, Date.now())) {
          return { response, registryWarpRoutes: resolvedRegistryWarpRoutes };
        }
      }
      throw new Error('Quote expired while resolving vault collateral token metadata');
    },
    enabled: enabled && amountAtomic != null && amountAtomic > 0n,
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });

  const hasChainAddresses = Object.keys(chainAddresses).length > 0;
  const quoteResponse = query.data?.response;
  const quotedRegistryWarpRoutes = query.data?.registryWarpRoutes ?? registryWarpRoutes;
  const augmented = useMemo<AugmentedQuote | undefined>(() => {
    if (!quoteResponse) return undefined;
    if (!chainsResp?.chains) return undefined;
    if (!hasChainAddresses) return undefined;
    const routes = quoteResponse.routes.filter((route) => {
      const wrappedNativeMetadataValidation = !srcWrappedNativeMetadata.valid
        ? srcWrappedNativeMetadata
        : !dstWrappedNativeMetadata.valid
          ? dstWrappedNativeMetadata
          : undefined;
      if (wrappedNativeMetadataValidation) {
        logger.warn('Filtered unsafe route', {
          reason: wrappedNativeMetadataValidation.reason,
          chainId: wrappedNativeMetadataValidation.chainId,
          trustedWrappedAddress: wrappedNativeMetadataValidation.trustedWrappedAddress,
          engineWrappedAddress: wrappedNativeMetadataValidation.engineWrappedAddress,
          warpRouteId: route.connection?.warpRouteId,
        });
        return false;
      }
      const amountValidation = validateRouteAmounts(route, values.slippageBps);
      if (!amountValidation.valid) {
        logger.warn('Filtered route with invalid output amounts', {
          reason: amountValidation.reason,
          warpRouteId: route.connection?.warpRouteId,
        });
        return false;
      }
      const validation = validateRouteSecurity(route, {
        chainMetadata,
        chainAddresses,
        registryWarpRoutes: quotedRegistryWarpRoutes,
        chains: chainsResp.chains,
        srcChain: values.srcChain!,
        dstChain: values.dstChain!,
        srcToken: values.srcToken,
        dstToken: values.dstToken,
        srcTokenWrappedAddress,
        dstTokenWrappedAddress,
      });
      if (validation.valid) return true;
      logger.warn('Filtered unsafe route', {
        reason: validation.reason,
        warpRouteId: validation.warpRouteId,
      });
      return false;
    });
    return {
      raw: { ...quoteResponse, routes },
      expiresAt: quoteResponse.expiresAt,
      routes: routes.map(augmentRoute),
    };
  }, [
    chainMetadata,
    chainAddresses,
    chainsResp?.chains,
    hasChainAddresses,
    quoteResponse,
    quotedRegistryWarpRoutes,
    values.dstChain,
    values.dstToken,
    values.slippageBps,
    values.srcChain,
    values.srcToken,
    srcWrappedNativeMetadata,
    dstWrappedNativeMetadata,
    srcTokenWrappedAddress,
    dstTokenWrappedAddress,
  ]);

  const expiresAt = augmented?.expiresAt;
  const quoteExpiryDelay = expiresAt == null ? -1 : quoteExpiryDelayMs(expiresAt, Date.now());
  const refreshNow = useCallback(() => {
    setNow(Date.now());
  }, []);

  useTimeout(refreshNow, quoteExpiryDelay);

  const isExpired = augmented ? augmented.expiresAt * 1000 < now : false;
  const isSecurityContextReady = !!chainsResp?.chains && hasChainAddresses;
  const isSecurityContextSettled = isSecurityContextReady || chainsError;
  const isQuoteSettled = isQuoteSettledForSecurity(
    query.isSuccess,
    query.isError,
    isSecurityContextSettled,
  );
  const isRouteDataUnavailable = query.isSuccess && chainsError;

  return {
    ...query,
    data: quoteResponse,
    quote: augmented,
    isExpired,
    isQuoteSettled,
    isRouteDataUnavailable,
  };
}

export function isQuoteFreshAfterResolution(expiresAt: number, nowMs: number): boolean {
  return quoteExpiryDelayMs(expiresAt, nowMs) >= QUOTE_RESOLUTION_SAFETY_MS;
}

export function quoteExpiryDelayMs(expiresAt: number, nowMs: number): number {
  return Math.max(expiresAt * 1000 - nowMs, 0);
}

export function isQuoteSettledForSecurity(
  isSuccess: boolean,
  isError: boolean,
  isSecurityContextSettled: boolean,
): boolean {
  return isError || (isSuccess && isSecurityContextSettled);
}

export function validateRouteAmounts(
  route: RouteResponse,
  slippageBps: number,
): { valid: true } | { valid: false; reason: string } {
  const finalStep = route.steps[route.steps.length - 1];
  if (!finalStep) return { valid: false, reason: 'Route has no steps' };
  if (finalStep.amountOut !== route.output) {
    return { valid: false, reason: 'Route output does not match final step amount' };
  }

  const canonicalShape = validateCanonicalSwapShape(route);
  if (!canonicalShape.valid) return canonicalShape;
  if (canonicalShape.swapStepCount === 0) return { valid: true };
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10_000) {
    return { valid: false, reason: 'Route slippage is invalid' };
  }

  try {
    const output = BigInt(route.output);
    const outputMin = BigInt(route.outputMin);
    const expectedMin = compoundSlippageMin(output, slippageBps, canonicalShape.swapStepCount);
    if (outputMin < expectedMin) {
      return { valid: false, reason: 'Route minimum output is below slippage tolerance' };
    }
    if (outputMin > output) {
      return { valid: false, reason: 'Route minimum output exceeds output' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Route output amount is invalid' };
  }
}

function validateCanonicalSwapShape(
  route: RouteResponse,
): { valid: true; swapStepCount: number } | { valid: false; reason: string } {
  const swapIndexes = route.steps.flatMap((step, index) => (step.type === 'swap' ? [index] : []));
  if (swapIndexes.length > 2) {
    return { valid: false, reason: 'Route has too many swap steps' };
  }

  const firstSwap = swapIndexes[0];
  const secondSwap = swapIndexes[1];
  const lastIndex = route.steps.length - 1;
  if (firstSwap != null && firstSwap !== 0 && firstSwap !== lastIndex) {
    return { valid: false, reason: 'Route swap step is not canonical' };
  }
  if (secondSwap != null && secondSwap !== lastIndex) {
    return { valid: false, reason: 'Route swap step is not canonical' };
  }
  if (swapIndexes.length === 2 && !route.steps.some((step) => step.type === 'bridge')) {
    return { valid: false, reason: 'Route has multiple swap steps without a bridge' };
  }

  return { valid: true, swapStepCount: swapIndexes.length };
}

function compoundSlippageMin(output: bigint, slippageBps: number, swapStepCount: number): bigint {
  let numerator = 1n;
  let denominator = 1n;
  const ratio = BigInt(10_000 - slippageBps);
  for (let i = 0; i < swapStepCount; i++) {
    numerator *= ratio;
    denominator *= 10_000n;
  }
  return (output * numerator) / denominator;
}

export function isQuoteRequestReady(v: TransferFormValues, sender: string | undefined): boolean {
  // Non-empty checks only — engine validates / normalizes per-protocol address shapes.
  // Recipient is the effective recipient (custom input or connected destination wallet);
  // gate on it like sender so we don't quote a route the user can't yet receive.
  if (!sender) return false;
  if (!v.recipient) return false;
  if (v.srcChain == null || v.dstChain == null) return false;
  if (!v.srcToken || !v.dstToken) return false;
  if (!v.amount || Number(v.amount) <= 0) return false;
  return true;
}

// Emit per-component fees so each is rendered against its actual token.
export function augmentRoute(raw: RouteResponse): AugmentedRoute {
  const hasFixedOutput = raw.steps.length > 0 && raw.steps.every((s) => s.type === 'bridge');

  // Fixed-output routes deliver deterministic amounts — clamp outputMin = output.
  const adjusted: RouteResponse = hasFixedOutput ? { ...raw, outputMin: raw.output } : raw;

  const components: FeeComponent[] = [];

  for (const step of adjusted.steps) {
    if (step.type !== 'bridge') continue;
    const tokenFee = BigInt(step.fee.tokenFee);
    const igpAmount = BigInt(step.fee.igpAmount);
    if (tokenFee > 0n) {
      components.push({
        category: 'bridge',
        amount: tokenFee,
        chainId: step.chain,
        tokenAddress: step.asset,
      });
    }
    if (igpAmount > 0n) {
      components.push({
        category: 'igp',
        amount: igpAmount,
        chainId: step.chain,
        tokenAddress: step.fee.igpToken,
        includedInAmountIn: step.fee.igpIncludedInAmountIn,
      });
    }
    const localNativeFee = BigInt(step.fee.localNativeFee);
    if (localNativeFee > 0n) {
      components.push({
        category: 'network',
        amount: localNativeFee,
        chainId: step.chain,
        tokenAddress: '0x0000000000000000000000000000000000000000',
      });
    }
  }

  const feeBreakdown: FeeBreakdown = {
    components,
    originGas: BigInt(adjusted.gas.originGas),
    destGas: BigInt(adjusted.gas.destGas),
  };

  return { raw: adjusted, feeBreakdown, hasFixedOutput };
}
