import type { UiToken } from './types';

export type TokenRouteKind = 'bridge' | 'swap';

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

export function getTokenRouteKind(
  token: UiToken,
  directRouteTokenKeys: Set<string>,
  counterpartToken?: UiToken,
): TokenRouteKind | undefined {
  if (directRouteTokenKeys.has(getTokenKey(token))) return 'bridge';
  if (token.canSwap && counterpartToken?.canSwap) return 'swap';
  return undefined;
}

export function getRoutePrefillToken(
  routeTokens: UiToken[],
  currentToken?: UiToken,
): UiToken | undefined {
  if (!routeTokens.length) return undefined;
  if (!currentToken) return routeTokens[0];

  const currentKey = getTokenKey(currentToken);
  // Origin changes prefer a direct bridge destination over preserving a
  // swap-only destination, so the user lands on the safest known route.
  return routeTokens.some((token) => getTokenKey(token) === currentKey)
    ? undefined
    : routeTokens[0];
}
