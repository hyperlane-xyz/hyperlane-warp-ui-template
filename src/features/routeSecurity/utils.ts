import { eqAddress, isZeroishAddress } from '@hyperlane-xyz/utils';

import type { ChainDiscovery, QuoteBridgeStep, RouteResponse } from '../api/types';

// Engine API native-token sentinel used in token/fee fields. This is not
// claiming every VM's native asset address is 0x0.
export const ENGINE_NATIVE_TOKEN_SENTINEL = '0x0000000000000000000000000000000000000000';

export function chainForId(
  chains: ChainDiscovery[] | undefined,
  chainId: number,
): ChainDiscovery | undefined {
  return chains?.find((chain) => chain.id === chainId);
}

export function firstBridge(route: RouteResponse): QuoteBridgeStep | undefined {
  return route.steps.find((step): step is QuoteBridgeStep => step.type === 'bridge');
}

export function sameTokenAddress(left: string, right: string): boolean {
  if (eqAddress(left, right)) return true;
  if (isHexAddressLike(left) && isHexAddressLike(right))
    return left.toLowerCase() === right.toLowerCase();
  return left === right;
}

export function isEngineNativeToken(address: string): boolean {
  return sameTokenAddress(address, ENGINE_NATIVE_TOKEN_SENTINEL);
}

export function isUnsetAddress(address: string): boolean {
  return isZeroishAddress(address);
}

function isHexAddressLike(address: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(address);
}
