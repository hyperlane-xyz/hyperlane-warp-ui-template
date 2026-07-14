import { Token } from '@hyperlane-xyz/sdk/token/Token';
import { TokenAmount } from '@hyperlane-xyz/sdk/token/TokenAmount';

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
