import { ProtocolType } from '@hyperlane-xyz/utils';
import { useTimeout } from '@hyperlane-xyz/widgets';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { bytesToHex, parseUnits, type Hex } from 'viem';

import { logger } from '../../../utils/logger';
import { useChains } from '../../api/hooks';
import { type MaxQuoteParams, routerClient } from '../../api/RouterClient';
import type { MaxQuoteResponse, QuoteResponse, RouteResponse } from '../../api/types';
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

// Normal quotes refresh 5s before the engine's 30s TTL.
const REFRESH_MS = 25_000;
const ROUTER_QUOTE_QUERY_KEY = ['router', 'quote'] as const;
const QUOTE_RESOLUTION_SAFETY_MS = 5_000;
const QUOTE_RESOLUTION_ATTEMPTS = 2;

interface QuoteQueryData {
  response: QuoteResponse;
  registryWarpRoutes: RegistryWarpRouteMap;
}

class MaxQuoteExpiredError extends Error {}

interface QuoteQueryKeyParams {
  srcChain: number | null;
  dstChain: number | null;
  srcToken: string;
  dstToken: string;
  amount: bigint | null;
  sender?: string;
  recipient?: string;
  slippageBps?: number;
}

export function quoteQueryKey(params: QuoteQueryKeyParams) {
  return [
    ...ROUTER_QUOTE_QUERY_KEY,
    params.srcChain,
    params.dstChain,
    params.srcToken,
    params.dstToken,
    params.amount?.toString() ?? null,
    params.sender ?? null,
    params.recipient ?? null,
    params.slippageBps ?? null,
  ] as const;
}

export function cacheMaxQuote(
  queryClient: QueryClient,
  params: MaxQuoteParams,
  response: MaxQuoteResponse,
  registryWarpRoutes: RegistryWarpRouteMap,
): void {
  queryClient.setQueryData<QuoteQueryData>(
    quoteQueryKey({ ...params, amount: BigInt(response.amount) }),
    { response, registryWarpRoutes },
  );
}

interface MaxQuoteIntent {
  params: Omit<MaxQuoteParams, 'senderPubKey'>;
  amount: bigint;
  expiresAt: number;
  pendingAmountSync: boolean;
}

export function isMaxQuoteIntentCurrent(
  intent: Pick<MaxQuoteIntent, 'params' | 'amount'>,
  params: Omit<MaxQuoteParams, 'senderPubKey'>,
  amount: bigint | null,
): boolean {
  return (
    intent.amount === amount && maxQuoteRequestKey(intent.params) === maxQuoteRequestKey(params)
  );
}

export function supportsMaxQuote(protocol: string | undefined): boolean {
  return protocol != null && protocol !== ProtocolType.Starknet;
}

export function quoteRefetchIntervalMs(
  maxQuoteExpiresAt?: number,
  nowMs = Date.now(),
): number | false {
  if (maxQuoteExpiresAt == null) return REFRESH_MS;
  const delay = maxQuoteExpiresAt * 1000 - nowMs;
  return delay > 0 ? delay : false;
}

function maxQuoteRequestKey(params: Omit<MaxQuoteParams, 'senderPubKey'>): string {
  return JSON.stringify([
    params.srcChain,
    params.dstChain,
    params.srcToken,
    params.dstToken,
    params.sender,
    params.recipient ?? null,
    params.slippageBps ?? null,
    params.commitmentSalt ?? null,
  ]);
}

function assertTransferableMaxQuote(response: MaxQuoteResponse): MaxQuoteResponse {
  if (BigInt(response.amount) <= 0n || response.routes.length === 0) {
    throw new Error('No transferable balance is available after network fees');
  }
  return response;
}

interface UseQuoteArgs {
  values: TransferFormValues;
  /** Sender from connected wallet — passed through as-is. */
  sender: string | undefined;
  senderPubKey?: Promise<string | undefined>;
  /** Pause auto-refresh (e.g. wallet modal open or tx signing). */
  pause?: boolean;
}

export function useQuote({ values, sender, senderPubKey, pause }: UseQuoteArgs) {
  const [now, setNow] = useState(() => Date.now());
  const queryClient = useQueryClient();
  const maxQuoteIntentRef = useRef<MaxQuoteIntent | null>(null);
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

  const maxQuoteRequestReady = isMaxQuoteRequestReady(values, engineSender);
  const maxQuoteParams = useMemo<Omit<MaxQuoteParams, 'senderPubKey'> | null>(
    () =>
      maxQuoteRequestReady
        ? {
            srcChain: values.srcChain!,
            dstChain: values.dstChain!,
            srcToken: values.srcToken,
            dstToken: values.dstToken,
            sender: engineSender!,
            recipient: engineRecipient,
            slippageBps: values.slippageBps,
            commitmentSalt,
          }
        : null,
    [
      commitmentSalt,
      engineRecipient,
      engineSender,
      maxQuoteRequestReady,
      values.dstChain,
      values.dstToken,
      values.slippageBps,
      values.srcChain,
      values.srcToken,
    ],
  );
  const srcProtocol = chainsResp?.chains.find((chain) => chain.id === values.srcChain)?.protocol;
  const maxQuoteUnavailableReason =
    srcProtocol === ProtocolType.Starknet ? 'Max is unavailable for Starknet transfers' : undefined;
  const canRequestMaxQuote =
    !!maxQuoteParams && !pause && supportsMaxQuote(srcProtocol) && srcTokenInfo?.decimals != null;

  const currentMaxIntent = maxQuoteIntentRef.current;
  if (currentMaxIntent && maxQuoteParams) {
    const sameRequest =
      maxQuoteRequestKey(currentMaxIntent.params) === maxQuoteRequestKey(maxQuoteParams);
    if (!sameRequest) {
      maxQuoteIntentRef.current = null;
    } else if (currentMaxIntent.amount === amountAtomic) {
      currentMaxIntent.pendingAmountSync = false;
    } else if (!currentMaxIntent.pendingAmountSync) {
      maxQuoteIntentRef.current = null;
    }
  } else if (currentMaxIntent && !maxQuoteParams) {
    maxQuoteIntentRef.current = null;
  }
  const activeMaxQuoteIntent =
    maxQuoteIntentRef.current &&
    maxQuoteParams &&
    isMaxQuoteIntentCurrent(maxQuoteIntentRef.current, maxQuoteParams, amountAtomic)
      ? maxQuoteIntentRef.current
      : null;

  const resolveQuote = useCallback(
    async <T extends QuoteResponse>(response: T, signal?: AbortSignal) => {
      const resolvedRegistryWarpRoutes = await resolveQuotedVaultCollateralTokens(
        registryWarpRoutes,
        response.routes,
        multiProvider,
        signal,
      );
      if (!isQuoteFreshAfterResolution(response.expiresAt, Date.now())) return null;
      return { response, registryWarpRoutes: resolvedRegistryWarpRoutes };
    },
    [multiProvider, registryWarpRoutes],
  );

  const fetchMaxQuote = useCallback(
    async (params: Omit<MaxQuoteParams, 'senderPubKey'>) => {
      const publicKey = await senderPubKey;
      for (let attempt = 0; attempt < QUOTE_RESOLUTION_ATTEMPTS; attempt++) {
        const response = assertTransferableMaxQuote(
          await routerClient.maxQuote({
            ...params,
            ...(publicKey && { senderPubKey: publicKey as `0x${string}` }),
          }),
        );
        const resolved = await resolveQuote(response);
        if (resolved) return resolved;
      }
      throw new Error('Maximum quote expired while resolving vault collateral token metadata');
    },
    [resolveQuote, senderPubKey],
  );
  const {
    mutateAsync: mutateMaxQuote,
    isPending: isMaxQuoteLoading,
    error: maxQuoteError,
  } = useMutation({
    onMutate: () => queryClient.cancelQueries({ queryKey: ROUTER_QUOTE_QUERY_KEY }),
    mutationFn: (params: Omit<MaxQuoteParams, 'senderPubKey'>) => fetchMaxQuote(params),
    onSuccess: ({ response, registryWarpRoutes: resolvedRegistryWarpRoutes }, params) => {
      maxQuoteIntentRef.current = {
        params,
        amount: BigInt(response.amount),
        expiresAt: response.expiresAt,
        pendingAmountSync: true,
      };
      cacheMaxQuote(queryClient, params, response, resolvedRegistryWarpRoutes);
    },
  });

  const requestMaxQuote = useCallback(async () => {
    if (!canRequestMaxQuote || !maxQuoteParams) {
      throw new Error(maxQuoteUnavailableReason ?? 'Select a route and connect a wallet first');
    }
    const result = await mutateMaxQuote(maxQuoteParams);
    return result.response;
  }, [canRequestMaxQuote, maxQuoteParams, maxQuoteUnavailableReason, mutateMaxQuote]);

  const query = useQuery<QuoteQueryData>({
    queryKey: quoteQueryKey({
      srcChain: values.srcChain,
      dstChain: values.dstChain,
      srcToken: values.srcToken,
      dstToken: values.dstToken,
      amount: amountAtomic,
      sender: engineSender,
      recipient: engineRecipient,
      slippageBps: values.slippageBps,
    }),
    queryFn: async ({ signal }) => {
      if (activeMaxQuoteIntent && maxQuoteIntentRef.current === activeMaxQuoteIntent) {
        throw new MaxQuoteExpiredError('Maximum quote expired. Click Max to recalculate.');
      }

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
        const resolved = await resolveQuote(response, signal);
        if (resolved) return resolved;
      }
      throw new Error('Quote expired while resolving vault collateral token metadata');
    },
    enabled: enabled && amountAtomic != null && amountAtomic > 0n && !isMaxQuoteLoading,
    refetchInterval: quoteRefetchIntervalMs(activeMaxQuoteIntent?.expiresAt),
    staleTime: activeMaxQuoteIntent ? Infinity : REFRESH_MS,
    refetchOnReconnect: !activeMaxQuoteIntent,
    retry: (failureCount, error) => !(error instanceof MaxQuoteExpiredError) && failureCount < 3,
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
    requestMaxQuote,
    canRequestMaxQuote,
    isMaxQuoteLoading,
    maxQuoteError,
    maxQuoteUnavailableReason,
    sourceTokenDecimals: srcTokenInfo?.decimals,
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
  if (!isMaxQuoteRequestReady(v, sender)) return false;
  if (!v.amount || Number(v.amount) <= 0) return false;
  return true;
}

export function isMaxQuoteRequestReady(v: TransferFormValues, sender: string | undefined): boolean {
  // Non-empty checks only — engine validates / normalizes per-protocol address shapes.
  // Recipient is the effective recipient (custom input or connected destination wallet);
  // gate on it like sender so we don't quote a route the user can't yet receive.
  if (!sender) return false;
  if (!v.recipient) return false;
  if (v.srcChain == null || v.dstChain == null) return false;
  if (!v.srcToken || !v.dstToken) return false;
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

  const sourceTransactionFee = adjusted.sourceTransactionFee;
  const sourceChain = adjusted.steps[0]?.chain;
  if (sourceTransactionFee && sourceChain != null && BigInt(sourceTransactionFee.amount) > 0n) {
    components.push({
      category: 'localGas',
      amount: BigInt(sourceTransactionFee.amount),
      chainId: sourceChain,
      tokenAddress: '0x0000000000000000000000000000000000000000',
    });
  }

  const feeBreakdown: FeeBreakdown = {
    components,
    originGas: BigInt(adjusted.gas.originGas),
    destGas: BigInt(adjusted.gas.destGas),
  };

  return { raw: adjusted, feeBreakdown, hasFixedOutput };
}
