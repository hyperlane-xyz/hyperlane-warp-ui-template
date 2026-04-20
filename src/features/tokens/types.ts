import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import type { TokenAmount } from '@hyperlane-xyz/sdk/token/TokenAmount';
import type { ChainName } from '@hyperlane-xyz/sdk/types';
import type { Address } from '@hyperlane-xyz/utils';

export type MultiCollateralTokenMap = Record<ChainName, Record<Address, Token[]>>;

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
