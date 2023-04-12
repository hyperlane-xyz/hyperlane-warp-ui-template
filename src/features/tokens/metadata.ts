import { z } from 'zod';

import SyntheticTokenList from '../../consts/tokens.json';
import { areAddressesEqual } from '../../utils/addresses';
import { logger } from '../../utils/logger';

/**
 * Zod schema for Token config validation
 */
const TokenSchema = z.object({
  chainId: z.number(),
  address: z.string(),
  name: z.string(),
  symbol: z.string(),
  decimals: z.number().positive(),
  logoURI: z.string().optional(),
  hypCollateralAddress: z.string(),
});

const TokenListSchema = z.object({
  tokens: z.array(TokenSchema),
});

export type TokenMetadata = z.infer<typeof TokenSchema>;

let tokens: TokenMetadata[];

export function getAllTokens() {
  if (!tokens) {
    const result = TokenListSchema.safeParse(SyntheticTokenList);
    if (!result.success) {
      logger.error('Invalid token config', result.error);
      throw new Error(`Invalid token config: ${result.error.toString()}`);
    }
    tokens = result.data.tokens;
  }
  return tokens;
}

export function getTokenMetadata(chainId: number, tokenAddress: Address) {
  return getAllTokens().find(
    (t) => t.chainId == chainId && areAddressesEqual(t.address, tokenAddress),
  );
}
