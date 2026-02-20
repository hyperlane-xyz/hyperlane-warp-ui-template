import { TestChainName, TokenStandard } from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockToken, createTokenConnectionMock } from '../../utils/test';
import { RouteLimit } from './types';
import { getMultiCollateralTokenLimit, isMultiCollateralLimitExceeded } from './utils';

const mockLimits: RouteLimit[] = [
  {
    amountWei: 100000n,
    chains: [TestChainName.test1, TestChainName.test2],
    symbol: 'FAKE',
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('getMultiCollateralTokenLimit', () => {
  test('returns null if destinationToken is not found', () => {
    const token = createMockToken({ connections: [createTokenConnectionMock()] });
    expect(getMultiCollateralTokenLimit(token, TestChainName.test3, mockLimits)).toBeNull();
  });

  test('should return null if tokens are not multi-collateral', () => {
    const token = createMockToken({
      connections: [createTokenConnectionMock()],
      standard: TokenStandard.CosmosIbc,
    });
    expect(getMultiCollateralTokenLimit(token, TestChainName.test2, mockLimits)).toBeNull();
  });

  test('should return null if no matching limit in routeLimits', () => {
    const token = createMockToken({
      symbol: 'NOMATCH',
      connections: [createTokenConnectionMock()],
    });
    expect(getMultiCollateralTokenLimit(token, TestChainName.test2, mockLimits)).toBeNull();
  });

  test('should return the correct limit if token pair matches', () => {
    const token = createMockToken({
      connections: [createTokenConnectionMock()],
    });
    expect(getMultiCollateralTokenLimit(token, TestChainName.test2, mockLimits)).toEqual(
      mockLimits[0],
    );
  });

  test('resolves limit using the exact destination token object', () => {
    const exactDestination = createMockToken({
      chainName: TestChainName.test2,
      symbol: 'FAKE',
      collateralAddressOrDenom: '0x1111111111111111111111111111111111111111',
    });
    const differentDestination = createMockToken({
      chainName: TestChainName.test2,
      symbol: 'OTHER',
      collateralAddressOrDenom: '0x2222222222222222222222222222222222222222',
    });
    const token = createMockToken({
      connections: [
        createTokenConnectionMock(undefined, {
          chainName: exactDestination.chainName,
          symbol: exactDestination.symbol,
          collateralAddressOrDenom: exactDestination.collateralAddressOrDenom,
          addressOrDenom: exactDestination.addressOrDenom,
        }),
      ],
    });

    expect(getMultiCollateralTokenLimit(token, exactDestination, mockLimits)).toEqual(mockLimits[0]);
    expect(getMultiCollateralTokenLimit(token, differentDestination, mockLimits)).toBeNull();
  });
});

describe('isMultiCollateralLimitExceeded', () => {
  test('should return null if limit is not exceeded', () => {
    const token = createMockToken({
      connections: [createTokenConnectionMock()],
    });
    expect(
      isMultiCollateralLimitExceeded(token, TestChainName.test2, '1000', mockLimits),
    ).toBeNull();
  });

  test('should return the limit if exceeded', () => {
    const token = createMockToken({
      connections: [createTokenConnectionMock()],
    });

    expect(
      isMultiCollateralLimitExceeded(token, TestChainName.test2, '10000000', mockLimits),
    ).toEqual(BigInt(mockLimits[0].amountWei));
  });

  test('uses exact destination token when checking exceeded limit', () => {
    const destinationToken = createMockToken({
      chainName: TestChainName.test2,
      symbol: 'OTHER',
    });
    const token = createMockToken({
      connections: [createTokenConnectionMock()],
    });

    expect(isMultiCollateralLimitExceeded(token, destinationToken, '10000000', mockLimits)).toBeNull();
  });
});
