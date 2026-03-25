import type { ChainMetadata } from '@hyperlane-xyz/sdk/metadata/chainMetadataTypes';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import type { TokenAmount } from '@hyperlane-xyz/sdk/token/TokenAmount';
import type { ChainMap } from '@hyperlane-xyz/sdk/types';

export type MultiCollateralTokenMap = Record<string, Record<string, Token[]>>;

export type TokenChainMap = {
  chains: ChainMap<{ token: Token; metadata: ChainMetadata | null }>;
  tokenInformation: Token;
};

export type Tokens = Array<{ token: Token; disabled: boolean }>;

export interface TokensWithDestinationBalance {
  originToken: Token;
  destinationToken: Token;
  balance: bigint;
}

export interface TokenWithFee {
  token: Token;
  tokenFee?: TokenAmount;
  balance: bigint;
}

export type TokenSelectionMode = 'origin' | 'destination';
export type DefaultMultiCollateralRoutes = Record<ChainName, Record<Address, Address>>;
