import { z } from 'zod';

import { ERC20Metadata, TokenType } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

export type MinimalTokenMetadata = Omit<ERC20Metadata, 'totalSupply'>;

// Extend SDK's TokenType enum to allow for IBC token routes
export enum IbcTokenTypes {
  IbcNative = 'ibc-native',
}
type ExtendedTokenType = TokenType | IbcTokenTypes;

// Define common fields for all token types
const commonTokenFields = z.object({
  chainId: z.union([z.number().positive(), z.string()]),
  name: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().nonnegative().optional(), // decimals == 0 for NFTs
  logoURI: z.string().optional(),
  igpTokenAddressOrDenom: z.string().optional(),
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
  type: `${ExtendedTokenType}`; // use template literal to allow string values
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

const IbcNativeTokenSchema = commonTokenFields.extend({
  type: z.literal(IbcTokenTypes.IbcNative),
});

interface IbcNativeTokenConfig extends BaseTokenConfig {
  type: IbcTokenTypes.IbcNative | 'ibc-native';
}

export const WarpTokenConfigSchema = z.array(
  CollateralTokenSchema.or(NativeTokenSchema).or(IbcNativeTokenSchema),
);
export type WarpTokenConfig = Array<
  CollateralTokenConfig | NativeTokenConfig | IbcNativeTokenConfig
>;

/**
 * Types for use in the app after processing config
 * Uses unambiguous CAIP IDs
 *
 * See src/features/tokens/metadata.ts
 */
interface BaseTokenMetadata extends MinimalTokenMetadata {
  type: ExtendedTokenType;
  tokenCaip19Id: TokenCaip19Id;
  routerAddress: Address; // Shared name for hypCollateralAddr or hypNativeAddr
  igpTokenAddressOrDenom?: Address;
  gasDenom?: string;
  logoURI?: string;
}

interface CollateralTokenMetadata extends BaseTokenMetadata {
  type: TokenType.collateral;
}

interface NativeTokenMetadata extends BaseTokenMetadata {
  type: TokenType.native;
}

interface IbcNativeTokenMetadata extends BaseTokenMetadata {
  type: IbcTokenTypes.IbcNative;
}

export type TokenMetadata = CollateralTokenMetadata | NativeTokenMetadata | IbcNativeTokenMetadata;

/**
 * Extended types including synthetic hyp token addresses
 */
interface HypTokens {
  hypTokens: Array<{ chain: ChainCaip2Id; router: Address; decimals: number }>;
}

type NativeTokenMetadataWithHypTokens = NativeTokenMetadata & HypTokens;
type CollateralTokenMetadataWithHypTokens = CollateralTokenMetadata & HypTokens;
type IbcNativeTokenMetadataWithHypTokens = IbcNativeTokenMetadata & HypTokens;
export type TokenMetadataWithHypTokens =
  | CollateralTokenMetadataWithHypTokens
  | NativeTokenMetadataWithHypTokens
  | IbcNativeTokenMetadataWithHypTokens;
