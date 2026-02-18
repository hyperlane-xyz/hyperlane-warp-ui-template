import { MultiProtocolProvider, Token } from '@hyperlane-xyz/sdk';
import { normalizeAddress } from '@hyperlane-xyz/utils';
import { logger } from '../../utils/logger';

export interface TokenEntry {
  token: Token;
  key: string;
}

export function tokenKey(token: Token): string {
  return `${token.chainName}:${normalizeAddress(token.addressOrDenom, token.protocol)}`;
}

/** Fetch a single token balance via SDK fallback. */
export async function fetchSdkBalance(
  token: Token,
  multiProvider: MultiProtocolProvider,
  address: string,
  out: Record<string, bigint>,
  key: string,
) {
  try {
    const balance = await token.getBalance(multiProvider, address);
    out[key] = balance.amount;
  } catch (err) {
    logger.warn(`Failed to fetch balance for ${key}`, err);
  }
}
