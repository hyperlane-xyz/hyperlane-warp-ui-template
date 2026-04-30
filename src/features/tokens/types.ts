import { Token, TokenAmount } from '@hyperlane-xyz/sdk';

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
