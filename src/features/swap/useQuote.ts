import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { bytesToHex, parseUnits, type Hex } from 'viem';

import { routerClient } from '../api/RouterClient';
import type { QuoteResponse, RouteResponse } from '../api/types';
import { useTokens } from './tokens/hooks';
import type {
  AugmentedQuote,
  AugmentedRoute,
  FeeBreakdown,
  FeeComponent,
  SwapFormValues,
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

interface UseQuoteArgs {
  values: SwapFormValues;
  /** Sender from connected wallet — passed through as-is. */
  sender: string | undefined;
  /** Pause auto-refresh (e.g. wallet modal open or tx signing). */
  pause?: boolean;
}

export function useQuote({ values, sender, pause }: UseQuoteArgs) {
  // Pass sender + recipient through as-is — engine handles per-protocol normalization.
  const engineSender = sender || undefined;
  const engineRecipient = values.recipient || undefined;

  const enabled = routerClient.isConfigured && isQuoteRequestReady(values, engineSender) && !pause;

  const { data: srcTokens } = useTokens(values.srcChain != null ? { chain: values.srcChain } : {});
  const srcTokenInfo = srcTokens.find(
    (t) => t.address.toLowerCase() === values.srcToken.toLowerCase(),
  );

  const amountAtomic = useMemo(() => {
    if (!srcTokenInfo || srcTokenInfo.decimals == null) return null;
    if (values.amount === '' || values.amount == null) return null;
    try {
      return parseUnits(String(values.amount) as `${number}`, srcTokenInfo.decimals);
    } catch {
      return null;
    }
  }, [srcTokenInfo, values.amount]);

  // Salt is stable per swap intent. Quote auto-refreshes share the same
  // salt; intent changes mint a fresh one.
  const commitmentSalt = useMemo(
    () => randomBytes32(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values.srcChain, values.dstChain, values.srcToken, values.dstToken],
  );

  const query = useQuery<QuoteResponse>({
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
    queryFn: () =>
      routerClient.quote({
        srcChain: values.srcChain!,
        dstChain: values.dstChain!,
        srcToken: values.srcToken,
        dstToken: values.dstToken,
        amount: amountAtomic!,
        sender: engineSender!,
        recipient: engineRecipient,
        slippageBps: values.slippageBps,
        commitmentSalt,
      }),
    enabled: enabled && amountAtomic != null && amountAtomic > 0n,
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });

  const augmented = useMemo<AugmentedQuote | undefined>(() => {
    if (!query.data) return undefined;
    return {
      raw: query.data,
      expiresAt: query.data.expiresAt,
      routes: query.data.routes.map(augmentRoute),
    };
  }, [query.data]);

  const isExpired = augmented ? augmented.expiresAt * 1000 < Date.now() : false;
  const isQuoteSettled = query.isSuccess || query.isError;

  return {
    ...query,
    quote: augmented,
    isExpired,
    isQuoteSettled,
  };
}

function isQuoteRequestReady(v: SwapFormValues, sender: string | undefined): boolean {
  // Non-empty checks only — engine validates / normalizes per-protocol address shapes.
  if (!sender) return false;
  if (v.srcChain == null || v.dstChain == null) return false;
  if (!v.srcToken || !v.dstToken) return false;
  if (!v.amount || Number(v.amount) <= 0) return false;
  return true;
}

// Emit per-component fees so each is rendered against its actual token.
function augmentRoute(raw: RouteResponse): AugmentedRoute {
  const isBridgeOnly = raw.steps.length > 0 && raw.steps.every((s) => s.type === 'bridge');

  // Bridge-only routes deliver deterministic amounts — clamp outputMin = output.
  const adjusted: RouteResponse = isBridgeOnly ? { ...raw, outputMin: raw.output } : raw;

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
      });
    }
  }

  const feeBreakdown: FeeBreakdown = {
    components,
    originGas: BigInt(adjusted.gas.originGas),
    destGas: BigInt(adjusted.gas.destGas),
  };

  return { raw: adjusted, feeBreakdown, isBridgeOnly };
}
