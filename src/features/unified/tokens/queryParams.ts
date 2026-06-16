import type { UnifiedToken } from './types';

export function getUnifiedTokenQueryRef(token: UnifiedToken): string {
  return token.swapToken?.address ?? token.bridgeToken?.symbol ?? token.addressOrDenom;
}
