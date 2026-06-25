import type { UiToken } from './types';

export function getTokenKey(token: UiToken): string {
  return `${token.chainId}-${token.address}`;
}
