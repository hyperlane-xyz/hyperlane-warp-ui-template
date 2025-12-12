import { ChainMap, ChainMetadata, Token, TokenAmount } from '@hyperlane-xyz/sdk';

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
