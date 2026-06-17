import type { UiToken } from './types';

export function getTokenKey(token: UiToken): string {
  return tokenKey(token.chainId, token.address);
}

export function tokenKey(chainId: number, address: string): string {
  const normalizedAddress = /^0x[a-fA-F0-9]{40}$/.test(address) ? address.toLowerCase() : address;
  return `${chainId}-${normalizedAddress}`;
}

// Origin → destination route check. Engine governs availability per
// (srcChain, srcToken, dstChain, dstToken) tuple; the picker doesn't
// have early access to that, so this is a permissive heuristic. The
// authoritative answer comes from /v1/quote.
export function checkTokenHasRoute(_origin: UiToken, _destination: UiToken): boolean {
  return true;
}
