import { z } from 'zod';

/**
 * Zod schema for Token config validation
 */
export const TokenSchema = z.object({
  chainId: z.number(),
  address: z.string(),
  hypCollateralAddress: z.string(),
  name: z.string(),
  symbol: z.string(),
  decimals: z.number().positive(),
  logoURI: z.string().optional(),
});

export const TokenListSchema = z.array(TokenSchema);

export type TokenMetadata = z.infer<typeof TokenSchema>;

export interface TokenMetadataWithHypTokens extends TokenMetadata {
  hypTokens: Array<{ chainId: number; address: Address }>;
}
