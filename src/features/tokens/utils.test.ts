import {
  TestChainName,
  Token,
  TokenArgs,
  TokenConnection,
  TokenConnectionType,
  TokenStandard,
} from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { isValidMultiCollateralToken } from './utils';

const mockCollateralAddress = '0xabc';
const addressZero = '0x0000000000000000000000000000000000000000';

const defaultTokenArgs: TokenArgs = {
  chainName: TestChainName.test1,
  standard: TokenStandard.EvmHypCollateral,
  addressOrDenom: addressZero,
  decimals: 6,
  symbol: 'FAKE',
  name: 'Fake Token',
  collateralAddressOrDenom: mockCollateralAddress,
};

const defaultTokenArgs2: TokenArgs = {
  ...defaultTokenArgs,
  chainName: TestChainName.test2,
};

const createMockToken = (args?: Partial<TokenArgs>) => {
  return new Token({ ...defaultTokenArgs, ...args });
};

const createTokenConnectionMock = (
  args?: Partial<TokenConnection>,
  tokenArgs?: Partial<TokenArgs>,
): TokenConnection => {
  return {
    type: TokenConnectionType.Hyperlane,
    token: createMockToken({ ...defaultTokenArgs2, ...tokenArgs }),
    ...args,
  } as TokenConnection;
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('isValidMultiCollateralToken', () => {
  test('should return false if originToken has no collateralAddressOrDenom', () => {
    const token = createMockToken({ collateralAddressOrDenom: undefined });
    expect(isValidMultiCollateralToken(token, 'destination')).toBe(false);
  });

  test('should return false if originToken is not collateralized', () => {
    const token = createMockToken({ standard: TokenStandard.CosmosIbc });
    expect(isValidMultiCollateralToken(token, 'destination')).toBe(false);
  });

  test('should return false if destinationToken is not found via chain name', () => {
    const token = createMockToken({ connections: [createTokenConnectionMock()] });
    expect(isValidMultiCollateralToken(token, 'destination')).toBe(false);
  });

  test('should return false if destinationToken has no collateralAddressOrDenom', () => {
    const token = createMockToken({
      connections: [createTokenConnectionMock(undefined, { collateralAddressOrDenom: undefined })],
    });
    expect(isValidMultiCollateralToken(token, TestChainName.test2)).toBe(false);
  });

  test('should return false if destinationToken is not collateralized', () => {
    const token = createMockToken({
      connections: [createTokenConnectionMock(undefined, { standard: TokenStandard.CosmosIbc })],
    });
    expect(isValidMultiCollateralToken(token, TestChainName.test2)).toBe(false);
  });

  test('should return true when tokens are valid with destinationToken as a string', () => {
    const token = createMockToken({
      connections: [createTokenConnectionMock()],
    });
    expect(isValidMultiCollateralToken(token, TestChainName.test2)).toBe(true);
  });

  test('should return true when tokens are valid with destinationToken as a IToken', () => {
    const token = createMockToken({
      connections: [createTokenConnectionMock()],
    });
    const destinationToken = token.getConnectionForChain(TestChainName.test2)!.token;
    expect(isValidMultiCollateralToken(token, destinationToken)).toBe(true);
  });
});
