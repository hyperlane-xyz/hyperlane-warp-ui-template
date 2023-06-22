import { z } from 'zod';

import { TokenType } from '@hyperlane-xyz/hyperlane-token';

import { ProtocolType } from '../chains/types';

const commonTokenFields = z.object({
  chainId: z.number().positive().or(z.string().nonempty()),
  protocol: z.nativeEnum(ProtocolType).optional(),
  name: z.string().nonempty(),
  symbol: z.string().nonempty(),
  decimals: z.number().nonnegative(), // decimals == 0 for NFTs
  logoURI: z.string().optional(),
});
type CommonTokenFields = z.infer<typeof commonTokenFields>;

/**
 * Types for the developer-provided config
 * Seems redundant with the *Metadata types below but these are
 * necessary to enable a more flexible and intuitive schema for the config
 * E.g. allow literal strings for 'type' field
 * or allow omitting 'address' for NativeTokenConfig
 *
 * See src/consts/tokens.ts
 */

type CommonFieldsWithLooseProtocol = Omit<CommonTokenFields, 'protocol'> & {
  protocol?: `${ProtocolType}`;
};
interface BaseTokenConfig extends CommonFieldsWithLooseProtocol {
  type: `${TokenType}`; // use template literal to allow string values
}

const CollateralTokenSchema = commonTokenFields.extend({
  type: z.literal(TokenType.collateral),
  address: z.string(),
  hypCollateralAddress: z.string(),
  isNft: z.boolean().optional(),
  isSpl2022: z.boolean().optional(), // Only required if using a 2022 version SPL Token on a Sealevel chain
});

interface CollateralTokenConfig extends BaseTokenConfig {
  // Typescript does not allow literal value value 'collateral' even if it matches the enum's value
  type: TokenType.collateral | 'collateral';
  address: Address;
  hypCollateralAddress: Address;
  isNft?: boolean;
  isSpl2022?: boolean;
}

const NativeTokenSchema = commonTokenFields.extend({
  type: z.literal(TokenType.native),
  hypNativeAddress: z.string(),
});

interface NativeTokenConfig extends BaseTokenConfig {
  type: TokenType.native | 'native';
  hypNativeAddress: Address;
}

export const WarpTokenConfigSchema = z.array(CollateralTokenSchema.or(NativeTokenSchema));
export type WarpTokenConfig = Array<CollateralTokenConfig | NativeTokenConfig>;

/**
 * Types for use in the app after processing config
 * Seems redundant with the *Config types above but these are
 * more restrictive and consistent (see comment above)
 *
 * See src/features/tokens/metadata.ts
 */
interface BaseTokenMetadata extends CommonTokenFields {
  caip2Id: Caip2Id;
  type: TokenType;
  address: Address;
  tokenRouterAddress: Address; // Shared name for hypCollateralAddr or hypNativeAddr
  isNft?: boolean;
}

interface CollateralTokenMetadata extends BaseTokenMetadata {
  type: TokenType.collateral;
  isSpl2022?: boolean;
}

interface NativeTokenMetadata extends BaseTokenMetadata {
  type: TokenType.native;
}

export type TokenMetadata = CollateralTokenMetadata | NativeTokenMetadata;

/**
 * Extended types including synthetic hyp token addresses
 */
interface HypTokens {
  hypTokens: Array<{ caip2Id: Caip2Id; address: Address }>;
}

type NativeTokenMetadataWithHypTokens = NativeTokenMetadata & HypTokens;
type CollateralTokenMetadataWithHypTokens = CollateralTokenMetadata & HypTokens;
export type TokenMetadataWithHypTokens =
  | CollateralTokenMetadataWithHypTokens
  | NativeTokenMetadataWithHypTokens;
