import type { UiToken } from './types';

export function getTokenKey(token: UiToken): string {
  return tokenKey(token.chainId, token.address);
}

export function tokenKey(chainId: number, address: string): string {
  const normalizedAddress = /^0x[a-fA-F0-9]{40}$/.test(address) ? address.toLowerCase() : address;
  return `${chainId}-${normalizedAddress}`;
}

export function mergeRouteTokensFirst(routeTokens: UiToken[], tokens: UiToken[]): UiToken[] {
  if (!routeTokens.length) return tokens;
  const seen = new Set<string>();
  const out: UiToken[] = [];
  for (const token of [...routeTokens, ...tokens]) {
    const key = getTokenKey(token);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}
