import type { UiToken } from './types';

export function getTokenKey(token: UiToken): string {
  return `${token.chainId}-${token.address.toLowerCase()}`;
}

// Origin → destination route check. Engine governs availability per
// (srcChain, srcToken, dstChain, dstToken) tuple; the picker doesn't
// have early access to that, so this is a permissive heuristic. The
// authoritative answer comes from /v1/quote.
export function checkTokenHasRoute(_origin: UiToken, _destination: UiToken): boolean {
  return true;
}
