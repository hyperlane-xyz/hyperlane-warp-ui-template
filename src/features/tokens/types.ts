<<<<<<< HEAD
import { ChainMap, ChainMetadata, Token, TokenAmount } from '@hyperlane-xyz/sdk';
=======
import { Token, TokenAmount } from '@hyperlane-xyz/sdk';
>>>>>>> origin/main

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

<<<<<<< HEAD
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
=======
export type TokenSelectionMode = 'origin' | 'destination';
export type DefaultMultiCollateralRoutes = Record<ChainName, Record<Address, Address>>;
>>>>>>> origin/main
