import { useMemo } from 'react';

import { WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { getQueryParams } from '../../utils/queryParams';
import { useTokens } from './tokens/hooks';
import type { SwapFormValues } from './types';

const EMPTY_VALUES: SwapFormValues = {
  srcChain: null,
  dstChain: null,
  srcToken: '',
  dstToken: '',
  amount: '',
  recipient: '',
  slippageBps: config.defaultSlippageBps,
};

// URL → Formik prefill. The swap tab's deep-link contract is
// address-based (engine `/v1/tokens?ids=` keys are `chainName-address`):
//   ?origin=<chainName>&originToken=<0xAddress>
//   ?destination=<chainName>&destinationToken=<0xAddress>
//
// Falls back to `config.defaultSwapOriginToken` /
// `defaultSwapDestinationToken` when the URL has no override — mirrors
// the bridge tab's defaultOriginToken / defaultDestinationToken pattern.
//
// The bridge tab still uses symbol-based URLs — they're independent
// pages so the divergence is fine.
export function useFormInitialValues(): SwapFormValues {
  const ids = useMemo(() => {
    const out: string[] = [];
    const { originId, destinationId } = readInitialIds();
    if (originId) out.push(originId);
    if (destinationId) out.push(destinationId);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-time read; URL changes after mount intentionally ignored
  }, []);

  const { data: tokens } = useTokens(ids.length ? { ids } : {});

  return useMemo(() => {
    if (!ids.length || !tokens.length) return EMPTY_VALUES;

    const { originId, destinationId } = readInitialIds();
    const origin = originId ? tokens.find((t) => matchesId(t, originId)) : undefined;
    const destination = destinationId ? tokens.find((t) => matchesId(t, destinationId)) : undefined;

    return {
      ...EMPTY_VALUES,
      srcChain: origin?.chainId ?? null,
      srcToken: origin?.address ?? '',
      dstChain: destination?.chainId ?? null,
      dstToken: destination?.address ?? '',
    };
  }, [tokens, ids]);
}

function readInitialIds(): { originId: string | undefined; destinationId: string | undefined } {
  if (typeof window === 'undefined') {
    return {
      originId: normalizeId(config.defaultSwapOriginToken),
      destinationId: normalizeId(config.defaultSwapDestinationToken),
    };
  }
  const params = getQueryParams();
  const originFromUrl = idFromParams(
    params.get(WARP_QUERY_PARAMS.ORIGIN),
    params.get(WARP_QUERY_PARAMS.ORIGIN_TOKEN),
  );
  const destinationFromUrl = idFromParams(
    params.get(WARP_QUERY_PARAMS.DESTINATION),
    params.get(WARP_QUERY_PARAMS.DESTINATION_TOKEN),
  );
  return {
    originId: originFromUrl ?? normalizeId(config.defaultSwapOriginToken),
    destinationId: destinationFromUrl ?? normalizeId(config.defaultSwapDestinationToken),
  };
}

function idFromParams(chain: string | null, token: string | null): string | undefined {
  if (!chain || !token) return undefined;
  return `${chain}-${token.toLowerCase()}`;
}

function normalizeId(id: string | undefined): string | undefined {
  return id ? id.toLowerCase() : undefined;
}

function matchesId(t: { chainName: string; address: string }, id: string): boolean {
  return `${t.chainName}-${t.address.toLowerCase()}` === id;
}
