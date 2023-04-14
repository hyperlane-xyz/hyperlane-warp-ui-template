import { tokenList } from '../../consts/tokens';
import { areAddressesEqual } from '../../utils/addresses';
import { logger } from '../../utils/logger';

import { TokenListSchema, TokenMetadata } from './types';

let tokens: TokenMetadata[];

export function getAllTokens() {
  if (!tokens) {
    const result = TokenListSchema.safeParse(tokenList);
    if (!result.success) {
      logger.error('Invalid token config', result.error);
      throw new Error(`Invalid token config: ${result.error.toString()}`);
    }
    tokens = result.data;
  }
  return tokens;
}

export function getTokenMetadata(chainId: number, tokenAddress: Address) {
  return getAllTokens().find(
    (t) => t.chainId == chainId && areAddressesEqual(t.address, tokenAddress),
  );
}
