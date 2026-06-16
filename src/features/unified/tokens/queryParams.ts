import { isZeroishAddress, normalizeAddress, type ProtocolType } from '@hyperlane-xyz/utils';

import { WARP_QUERY_PARAMS } from '../../../consts/args';
import type { UnifiedToken } from './types';

export function getUnifiedTokenQueryRef(token: UnifiedToken): string {
  return (
    token.bridgeToken?.collateralAddressOrDenom ??
    token.bridgeToken?.addressOrDenom ??
    token.swapToken?.address ??
    token.addressOrDenom
  );
}

export function getUnifiedTokenQueryParams(
  token: UnifiedToken,
  selectionMode: 'origin' | 'destination',
): Record<string, string> {
  return {
    [selectionMode === 'origin' ? WARP_QUERY_PARAMS.ORIGIN : WARP_QUERY_PARAMS.DESTINATION]:
      token.chainName,
    [selectionMode === 'origin'
      ? WARP_QUERY_PARAMS.ORIGIN_TOKEN
      : WARP_QUERY_PARAMS.DESTINATION_TOKEN]: getUnifiedTokenQueryRef(token),
  };
}

export function findUnifiedTokenByQueryRef(
  tokens: UnifiedToken[],
  chainName: string,
  tokenRef: string,
): UnifiedToken | undefined {
  const chainTokens = tokens.filter(
    (token) => token.chainName.toLowerCase() === chainName.toLowerCase(),
  );
  const isZeroishRef = isZeroishAddress(tokenRef);

  if (isZeroishRef) {
    return (
      chainTokens.find((token) => token.bridgeToken?.isHypNative()) ??
      chainTokens.find((token) => token.swapToken?.isNative) ??
      chainTokens.find((token) => token.isNative)
    );
  }

  return (
    chainTokens.find((token) =>
      matchesRef(
        token.bridgeToken?.collateralAddressOrDenom,
        tokenRef,
        token.bridgeToken?.protocol,
      ),
    ) ??
    chainTokens.find((token) =>
      matchesRef(token.bridgeToken?.addressOrDenom, tokenRef, token.bridgeToken?.protocol),
    ) ??
    chainTokens.find((token) => matchesRef(token.swapToken?.address, tokenRef)) ??
    chainTokens.find((token) => matchesRef(token.addressOrDenom, tokenRef))
  );
}

export function findUnifiedTokenByConfigRef(
  tokens: UnifiedToken[],
  chainName: string,
  tokenRef: string,
): UnifiedToken | undefined {
  return (
    findUnifiedTokenByQueryRef(tokens, chainName, tokenRef) ??
    tokens.find(
      (token) =>
        token.chainName.toLowerCase() === chainName.toLowerCase() &&
        token.symbol.toLowerCase() === tokenRef.toLowerCase(),
    )
  );
}

function matchesRef(value: string | undefined, tokenRef: string, protocol?: ProtocolType): boolean {
  if (!value) return false;
  return normalizeRef(value, protocol) === normalizeRef(tokenRef, protocol);
}

function normalizeRef(value: string, protocol?: ProtocolType): string {
  try {
    return normalizeAddress(value, protocol);
  } catch {
    return value.toLowerCase();
  }
}
