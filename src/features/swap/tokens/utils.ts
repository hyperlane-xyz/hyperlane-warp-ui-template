import type { UiToken } from './types';

export function getTokenKey(token: UiToken): string {
  return getTokenKeyByAddress(token.chainId, token.address);
}

export function getTokenKeyByAddress(chainId: number, address: string): string {
  return `${chainId}-${normalizeTokenKeyAddress(address)}`;
}

export function getTokenByChainAndAddress(
  tokenMap: Map<string, UiToken>,
  chainId: number,
  address: string,
): UiToken | undefined {
  return tokenMap.get(getTokenKeyByAddress(chainId, address));
}

function normalizeTokenKeyAddress(address: string): string {
  return /^0x[a-fA-F0-9]{40}$/.test(address) ? address.toLowerCase() : address;
}
