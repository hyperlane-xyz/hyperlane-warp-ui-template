import { TestChainName, TokenStandard } from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockToken, createTokenConnectionMock } from '../../utils/test';
import { isValidMultiCollateralToken } from './utils';

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
