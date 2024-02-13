import { ChainName } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

export type HyperlaneChainId = ChainName | ChainId | DomainId;
export type Numberish = number | string | bigint;

export enum TokenStandard {
  // EVM
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  EvmNative = 'EvmNative',
  EvmHypNative = 'EvmHypNative',
  EvmHypCollateral = 'EvmHypCollateral',
  EvmHypSynthetic = 'EvmHypSynthetic',

  // Sealevel (Solana)
  SealevelSpl = 'SealevelSpl',
  SealevelSpl2022 = 'SealevelSpl2022',
  SealevelNative = 'SealevelNative',
  SealevelHypNative = 'SealevelHypNative',
  SealevelHypCollateral = 'SealevelHypCollateral',
  SealevelHypSynthetic = 'SealevelHypSynthetic',

  // Cosmos
  CosmosIcs20 = 'CosmosIcs20',
  CosmosIcs721 = 'CosmosIcs721',
  CosmosNative = 'CosmosNative',
  CosmosIbc = 'CosmosIbc',
  CosmosFactory = 'CosmosFactory',

  // CosmWasm
  CW20 = 'CW20',
  CWNative = 'CWNative',
  CW721 = 'CW721',
  CwHypNative = 'CwHypNative',
  CwHypCollateral = 'CwHypCollateral',
  CwHypSynthetic = 'CwHypSynthetic',

  // Fuel (TODO)
  FuelNative = 'FuelNative',
}

export const TOKEN_NFT_STANDARDS = [
  TokenStandard.ERC721,
  TokenStandard.CosmosIcs721,
  TokenStandard.CW721,
  // TODO solana here
];

export const TOKEN_HYP_STANDARDS = [
  TokenStandard.EvmHypNative,
  TokenStandard.EvmHypCollateral,
  TokenStandard.EvmHypSynthetic,
  TokenStandard.SealevelHypNative,
  TokenStandard.SealevelHypCollateral,
  TokenStandard.SealevelHypSynthetic,
  TokenStandard.CwHypNative,
  TokenStandard.CwHypCollateral,
  TokenStandard.CwHypSynthetic,
];

export const TOKEN_MULTI_CHAIN_STANDARDS = [...TOKEN_HYP_STANDARDS, TokenStandard.CosmosIbc];

export const PROTOCOL_TO_NATIVE_STANDARD: Record<ProtocolType, TokenStandard> = {
  [ProtocolType.Ethereum]: TokenStandard.EvmNative,
  [ProtocolType.Cosmos]: TokenStandard.CosmosNative,
  [ProtocolType.Sealevel]: TokenStandard.SealevelNative,
  [ProtocolType.Fuel]: TokenStandard.FuelNative,
};

// Map of protocol to either quote constant or to a map of chain name to quote constant
export type IgpQuoteConstants = Array<{
  origin: ChainName;
  destination: ChainName;
  quote: string | number | bigint;
}>;

export type RouteBlacklist = Array<{ origin: ChainName; destination: ChainName }>;
