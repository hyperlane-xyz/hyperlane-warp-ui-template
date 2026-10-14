import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { useMemo } from 'react';

import { WARP_QUERY_PARAMS } from '../../../consts/args';
import { config } from '../../../consts/config';
import { getQueryParams } from '../../../utils/queryParams';
import { useMultiProvider } from '../../chains/hooks';
import { isChainDisabled } from '../../chains/utils';
import { useTokens } from '../../tokens/hooks';
import type { UiToken } from '../../tokens/types';
import type { TransferFormValues } from './types';

const EMPTY_VALUES: TransferFormValues = {
  srcChain: null,
  dstChain: null,
  srcToken: '',
  dstToken: '',
  amount: '',
  recipient: '',
  slippageBps: config.defaultSlippageBps,
};

// URL → Formik prefill. The transfer deep-link contract is address-based
// (engine `/v1/tokens?ids=` keys are `chainName-address`):
//   ?origin=<chainName>&originToken=<0xAddress>
//   ?destination=<chainName>&destinationToken=<0xAddress>
//
// Falls back to `config.defaultTransferOriginToken` /
// `defaultTransferDestinationToken` when the URL has no override.
export function useFormInitialValues(): TransferFormValues {
  const multiProvider = useMultiProvider();
  const initialIds = useMemo(() => readInitialIds(), []);
  const ids = useMemo(() => {
    const out: string[] = [];
    const { originId, destinationId } = initialIds;
    if (originId) out.push(originId);
    if (destinationId) out.push(destinationId);
    return out;
  }, [initialIds]);

  const { data: tokens } = useTokens(ids.length ? { ids } : {});

  return useMemo(() => {
    return getInitialValuesFromTokens(tokens, initialIds, multiProvider);
  }, [tokens, initialIds, multiProvider]);
}

export function getInitialValuesFromTokens(
  tokens: UiToken[],
  initialIds: { originId: string | undefined; destinationId: string | undefined },
  multiProvider: Pick<MultiProtocolProvider, 'tryGetChainMetadata'>,
): TransferFormValues {
  if (!initialIds.originId && !initialIds.destinationId) return EMPTY_VALUES;
  if (!tokens.length) return EMPTY_VALUES;

  const { originId, destinationId } = initialIds;
  const origin = originId ? tokens.find((t) => matchesId(t, originId)) : undefined;
  const destination = destinationId ? tokens.find((t) => matchesId(t, destinationId)) : undefined;
  const enabledOrigin = isTokenChainEnabled(origin, multiProvider);
  const enabledDestination = isTokenChainEnabled(destination, multiProvider);

  return {
    ...EMPTY_VALUES,
    srcChain: enabledOrigin?.chainId ?? null,
    srcToken: enabledOrigin?.address ?? '',
    dstChain: enabledDestination?.chainId ?? null,
    dstToken: enabledDestination?.address ?? '',
  };
}

function readInitialIds(): { originId: string | undefined; destinationId: string | undefined } {
  if (typeof window === 'undefined') {
    return {
      originId: normalizeId(config.defaultTransferOriginToken),
      destinationId: normalizeId(config.defaultTransferDestinationToken),
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
    originId: originFromUrl ?? normalizeId(config.defaultTransferOriginToken),
    destinationId: destinationFromUrl ?? normalizeId(config.defaultTransferDestinationToken),
  };
}

function idFromParams(chain: string | null, token: string | null): string | undefined {
  if (!chain || !token) return undefined;
  return `${chain}-${token}`;
}

function normalizeId(id: string | undefined): string | undefined {
  return id;
}

function matchesId(t: { chainName: string; address: string }, id: string): boolean {
  const prefix = `${t.chainName}-`;
  if (!id.startsWith(prefix)) return false;
  const address = id.slice(prefix.length);
  return normalizeTokenAddress(t.address) === normalizeTokenAddress(address);
}

function isTokenChainEnabled<T extends { chainName: string }>(
  token: T | undefined,
  multiProvider: Pick<MultiProtocolProvider, 'tryGetChainMetadata'>,
): T | undefined {
  if (!token) return undefined;
  const metadata = multiProvider.tryGetChainMetadata(token.chainName);
  return isChainDisabled(metadata ?? null) ? undefined : token;
}

function normalizeTokenAddress(address: string): string {
  return /^0x[a-fA-F0-9]+$/.test(address) ? address.toLowerCase() : address;
}
