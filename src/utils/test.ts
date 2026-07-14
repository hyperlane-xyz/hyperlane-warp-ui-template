import { TestChainName } from '@hyperlane-xyz/sdk';
import { TokenArgs } from '@hyperlane-xyz/sdk/token/IToken';
import { Token } from '@hyperlane-xyz/sdk/token/Token';
import { TokenConnection, TokenConnectionType } from '@hyperlane-xyz/sdk/token/TokenConnection';
import { TokenStandard } from '@hyperlane-xyz/sdk/token/TokenStandard';

export const mockCollateralAddress = '0xabc';
export const addressZero = '0x0000000000000000000000000000000000000000';

export const defaultTokenArgs: TokenArgs = {
  chainName: TestChainName.test1,
  standard: TokenStandard.EvmHypCollateral,
  addressOrDenom: addressZero,
  decimals: 6,
  symbol: 'FAKE',
  name: 'Fake Token',
  collateralAddressOrDenom: mockCollateralAddress,
};

export const defaultTokenArgs2: TokenArgs = {
  ...defaultTokenArgs,
  chainName: TestChainName.test2,
};

export const createMockToken = (args?: Partial<TokenArgs>) => {
  return new Token({ ...defaultTokenArgs, ...args });
};

export const createTokenConnectionMock = (
  args?: Partial<TokenConnection>,
  tokenArgs?: Partial<TokenArgs>,
): TokenConnection => {
  return {
    type: TokenConnectionType.Hyperlane,
    token: createMockToken({ ...defaultTokenArgs2, ...tokenArgs }),
    ...args,
  } as TokenConnection;
};
