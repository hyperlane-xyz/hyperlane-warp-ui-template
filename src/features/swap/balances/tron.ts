import { logger } from '../../../utils/logger';
import type { UiToken } from '../tokens/types';

// Tron balance fetcher stub. TRC20 balance lookups need TronWeb's
// contract reader, which isn't yet wired. Returns empty so the
// dispatcher proceeds gracefully.
export async function fetchTronChainBalances(
  tokens: UiToken[],
  _userAddress: string,
): Promise<Record<string, bigint>> {
  if (tokens.length === 0) return {};
  logger.warn(
    `Tron balance fetch is not yet implemented — skipping ${tokens.length} token(s) on ${tokens[0]?.chainName}`,
  );
  return {};
}
