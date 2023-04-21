import { ethers } from 'ethers';
import { z } from 'zod';

import { TokenType } from '@hyperlane-xyz/hyperlane-token';

const commonTokenFields = z.object({
  chainId: z.number().positive(),
  name: z.string(),
  symbol: z.string(),
  decimals: z.number().positive(),
  logoURI: z.string().optional(),
});
type CommonTokenFields = z.infer<typeof commonTokenFields>;

/**
 * Types for the developer-provided config
 * See src/consts/tokens.ts
 */

interface BaseTokenConfig extends CommonTokenFields {
  type: `${TokenType}`; // use template literal to allow string values
}

const CollateralTokenSchema = commonTokenFields.extend({
  type: z.literal(TokenType.collateral),
  address: z.string(),
  hypCollateralAddress: z.string(),
});

interface CollateralTokenConfig extends BaseTokenConfig {
  type: TokenType.collateral | 'collateral';
  address: Address;
  hypCollateralAddress: Address;
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
 * Necessary to allow more flexibility with the config
 * See src/features/tokens/metadata.ts
 */
interface BaseTokenMetadata extends CommonTokenFields {
  type: TokenType;
  address: Address;
  hypWrapperAddress: Address; // Shared name for hypCollateralAddr and hypNativeAddr
}

interface CollateralTokenMetadata extends BaseTokenMetadata {
  type: TokenType.collateral;
}

type ZeroAddress = `${typeof ethers.constants.AddressZero}`;
interface NativeTokenMetadata extends BaseTokenMetadata {
  type: TokenType.native;
  address: ZeroAddress;
}

export type TokenMetadata = CollateralTokenMetadata | NativeTokenMetadata;

/**
 * Extended types including remote hyp token addresses
 */
interface HypTokens {
  hypTokens: Array<{ chainId: ChainId; address: Address }>;
}

type NativeTokenMetadataWithHypTokens = NativeTokenMetadata & HypTokens;
type CollateralTokenMetadataWithHypTokens = CollateralTokenMetadata & HypTokens;
export type TokenMetadataWithHypTokens =
  | CollateralTokenMetadataWithHypTokens
  | NativeTokenMetadataWithHypTokens;
