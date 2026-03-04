import { TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockToken } from '../../utils/test';
import { TokensWithDestinationBalance, TokenWithFee } from '../tokens/types';
import * as tokenUtils from '../tokens/utils';
import {
  compareByBalanceDesc,
  filterAndSortTokensByBalance,
  getTotalFee,
  getTransferToken,
  sortTokensByFee,
} from './fees';

// Common test constants
const MOCK_RECIPIENT = '0xrecipient';
const MOCK_SENDER = '0xsender';
const TRANSFER_AMOUNT = '500000';
const LARGE_TRANSFER_AMOUNT = '1000000';

// Balance constants (collateral/token balances)
const BALANCE_TINY = BigInt(100);
const BALANCE_SMALL = BigInt(500);
const BALANCE_MEDIUM = BigInt(1000);
const BALANCE_LARGE = BigInt(1000000);
const BALANCE_XLARGE = BigInt(2000000);
const BALANCE_XXLARGE = BigInt(5000000);

// Fee constants
const FEE_LOW = BigInt(1000);
const FEE_MEDIUM = BigInt(3000);
const FEE_HIGH = BigInt(5000);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('getTotalFee', () => {
  test('should group fungible tokens and sum their values', () => {
    const token1 = createMockToken({ symbol: 'ETH', decimals: 18 });
    const token2 = createMockToken({ symbol: 'ETH', decimals: 18 });

    // Mock isFungibleWith to return true for same tokens
    vi.spyOn(token1, 'isFungibleWith').mockReturnValue(true);

    const interchainQuote = token1.amount('1000000000000000000');
    const localQuote = token2.amount('500000000000000000');

    const result = getTotalFee({ interchainQuote, localQuote });

    expect(result).toHaveLength(1);
    expect(result[0].token).toEqual(token1);
    expect(result[0].amount).toEqual(BigInt('1500000000000000000'));
  });

  test('should separate non-fungible tokens with same symbol', () => {
    const token1 = createMockToken({ symbol: 'ETH', decimals: 18, chainName: 'ethereum' });
    const token2 = createMockToken({ symbol: 'ETH', decimals: 18, chainName: 'polygon' });

    // Mock isFungibleWith to return false for different chain tokens
    vi.spyOn(token1, 'isFungibleWith').mockReturnValue(false);

    const interchainQuote = token1.amount('1000000000000000000');
    const localQuote = token2.amount('500000000000000000');

    const result = getTotalFee({ interchainQuote, localQuote });

    // Now we can properly handle same symbols but non-fungible tokens
    expect(result).toHaveLength(2);
    expect(result[0].token).toEqual(token1);
    expect(result[0].amount).toEqual(BigInt('1000000000000000000'));
    expect(result[1].token).toEqual(token2);
    expect(result[1].amount).toEqual(BigInt('500000000000000000'));
  });

  test('should handle three different tokens separately', () => {
    const ethToken = createMockToken({ symbol: 'ETH', decimals: 18 });
    const usdcToken = createMockToken({ symbol: 'USDC', decimals: 6 });
    const wethToken = createMockToken({ symbol: 'WETH', decimals: 18 });

    // Mock isFungibleWith to return false for all combinations
    vi.spyOn(ethToken, 'isFungibleWith').mockReturnValue(false);
    vi.spyOn(usdcToken, 'isFungibleWith').mockReturnValue(false);
    vi.spyOn(wethToken, 'isFungibleWith').mockReturnValue(false);

    const interchainQuote = ethToken.amount('1000000000000000000');
    const localQuote = usdcToken.amount('1000000');
    const tokenFeeQuote = wethToken.amount('2000000000000000000');

    const result = getTotalFee({ interchainQuote, localQuote, tokenFeeQuote });

    expect(result).toHaveLength(3);
    expect(result[0].token).toEqual(ethToken);
    expect(result[0].amount).toEqual(BigInt('1000000000000000000'));
    expect(result[1].token).toEqual(usdcToken);
    expect(result[1].amount).toEqual(BigInt('1000000'));
    expect(result[2].token).toEqual(wethToken);
    expect(result[2].amount).toEqual(BigInt('2000000000000000000'));
  });

  test('should handle partial fungibility - two fungible, one separate', () => {
    const ethToken1 = createMockToken({ symbol: 'ETH', decimals: 18 });
    const ethToken2 = createMockToken({ symbol: 'ETH', decimals: 18 });
    const usdcToken = createMockToken({ symbol: 'USDC', decimals: 6 });

    // Mock ETH tokens to be fungible with each other but not with USDC
    vi.spyOn(ethToken1, 'isFungibleWith').mockImplementation(
      (token) => token === ethToken2 || token === ethToken1,
    );
    vi.spyOn(ethToken2, 'isFungibleWith').mockImplementation(
      (token) => token === ethToken1 || token === ethToken2,
    );
    vi.spyOn(usdcToken, 'isFungibleWith').mockReturnValue(false);

    const interchainQuote = ethToken1.amount('1000000000000000000');
    const localQuote = ethToken2.amount('500000000000000000');
    const tokenFeeQuote = usdcToken.amount('1000000');

    const result = getTotalFee({ interchainQuote, localQuote, tokenFeeQuote });

    expect(result).toHaveLength(2);
    expect(result[0].token).toEqual(ethToken1);
    expect(result[0].amount).toEqual(BigInt('1500000000000000000'));
    expect(result[1].token).toEqual(usdcToken);
    expect(result[1].amount).toEqual(BigInt('1000000'));
  });

  test('should handle optional tokenFeeQuote being undefined', () => {
    const ethToken = createMockToken({ symbol: 'ETH', decimals: 18 });
    const usdcToken = createMockToken({ symbol: 'USDC', decimals: 6 });

    vi.spyOn(ethToken, 'isFungibleWith').mockReturnValue(false);

    const interchainQuote = ethToken.amount('1000000000000000000');
    const localQuote = usdcToken.amount('1000000');

    const result = getTotalFee({ interchainQuote, localQuote, tokenFeeQuote: undefined });

    expect(result).toHaveLength(2);
    expect(result[0].token).toEqual(ethToken);
    expect(result[0].amount).toEqual(BigInt('1000000000000000000'));
    expect(result[1].token).toEqual(usdcToken);
    expect(result[1].amount).toEqual(BigInt('1000000'));
  });

  test('should handle zero amounts', () => {
    const ethToken1 = createMockToken({ symbol: 'ETH', decimals: 18 });
    const ethToken2 = createMockToken({ symbol: 'ETH', decimals: 18 });

    vi.spyOn(ethToken1, 'isFungibleWith').mockReturnValue(true);

    const interchainQuote = ethToken1.amount('0');
    const localQuote = ethToken2.amount('1000000000000000000');

    const result = getTotalFee({ interchainQuote, localQuote });

    expect(result).toHaveLength(1);
    expect(result[0].token).toEqual(ethToken1);
    expect(result[0].amount).toEqual(BigInt('1000000000000000000'));
  });

  test('should handle large numbers correctly', () => {
    const ethToken1 = createMockToken({ symbol: 'ETH', decimals: 18 });
    const ethToken2 = createMockToken({ symbol: 'ETH', decimals: 18 });

    vi.spyOn(ethToken1, 'isFungibleWith').mockReturnValue(true);

    const largeAmount1 = '999999999999999999999999999';
    const largeAmount2 = '1000000000000000000000000000';

    const interchainQuote = ethToken1.amount(largeAmount1);
    const localQuote = ethToken2.amount(largeAmount2);

    const result = getTotalFee({ interchainQuote, localQuote });

    expect(result).toHaveLength(1);
    expect(result[0].token).toEqual(ethToken1);
    expect(result[0].amount).toEqual(BigInt(largeAmount1) + BigInt(largeAmount2));
  });

  test('should handle tokenFeeQuote fungible with interchainQuote only', () => {
    const ethToken = createMockToken({ symbol: 'ETH', decimals: 18 });
    const usdcToken = createMockToken({ symbol: 'USDC', decimals: 6 });
    const ethToken2 = createMockToken({ symbol: 'ETH', decimals: 18 });

    vi.spyOn(ethToken, 'isFungibleWith').mockReturnValue(false);
    vi.spyOn(usdcToken, 'isFungibleWith').mockReturnValue(false);
    vi.spyOn(ethToken2, 'isFungibleWith').mockImplementation((token) => token === ethToken);

    const interchainQuote = ethToken.amount('1000000000000000000');
    const localQuote = usdcToken.amount('1000000');
    const tokenFeeQuote = ethToken2.amount('2000000000000000000');

    const result = getTotalFee({ interchainQuote, localQuote, tokenFeeQuote });

    expect(result).toHaveLength(2);
    expect(result[0].token).toEqual(ethToken);
    expect(result[0].amount).toEqual(BigInt('3000000000000000000'));
    expect(result[1].token).toEqual(usdcToken);
    expect(result[1].amount).toEqual(BigInt('1000000'));
  });

  test('should handle tokenFeeQuote fungible with localQuote only', () => {
    const ethToken = createMockToken({ symbol: 'ETH', decimals: 18 });
    const usdcToken = createMockToken({ symbol: 'USDC', decimals: 6 });
    const usdceToken = createMockToken({ symbol: 'USDC', decimals: 6 });

    vi.spyOn(ethToken, 'isFungibleWith').mockReturnValue(false);
    vi.spyOn(usdcToken, 'isFungibleWith').mockReturnValue(false);
    vi.spyOn(usdceToken, 'isFungibleWith').mockImplementation((token) => token === usdcToken);

    const interchainQuote = ethToken.amount('1000000000000000000');
    const localQuote = usdcToken.amount('1000000');
    const tokenFeeQuote = usdceToken.amount('2000000');

    const result = getTotalFee({ interchainQuote, localQuote, tokenFeeQuote });

    expect(result).toHaveLength(2);
    expect(result[0].token).toEqual(ethToken);
    expect(result[0].amount).toEqual(BigInt('1000000000000000000'));
    expect(result[1].token).toEqual(usdcToken);
    expect(result[1].amount).toEqual(BigInt('3000000'));
  });

  test('should handle tokenFeeQuote fungible with all other tokens', () => {
    const token1 = createMockToken({ symbol: 'USDC', decimals: 6 });
    const token2 = createMockToken({ symbol: 'USDC', decimals: 6 });
    const token3 = createMockToken({ symbol: 'USDC', decimals: 6 });

    vi.spyOn(token1, 'isFungibleWith').mockImplementation(
      (token) => token === token2 || token === token3,
    );
    vi.spyOn(token2, 'isFungibleWith').mockImplementation(
      (token) => token === token1 || token === token3,
    );
    vi.spyOn(token3, 'isFungibleWith').mockImplementation(
      (token) => token === token1 || token === token2,
    );

    const interchainQuote = token1.amount('1000000');
    const localQuote = token2.amount('2000000');
    const tokenFeeQuote = token3.amount('3000000');

    const result = getTotalFee({ interchainQuote, localQuote, tokenFeeQuote });

    expect(result).toHaveLength(1);
    expect(result[0].token).toEqual(token1);
    expect(result[0].amount).toEqual(BigInt('6000000'));
  });
});

describe('compareByBalanceDesc', () => {
  test('should return -1 when first balance is greater', () => {
    expect(compareByBalanceDesc({ balance: BALANCE_TINY }, { balance: BigInt(50) })).toBe(-1);
  });

  test('should return 1 when first balance is smaller', () => {
    expect(compareByBalanceDesc({ balance: BigInt(50) }, { balance: BALANCE_TINY })).toBe(1);
  });

  test('should return 0 when balances are equal', () => {
    expect(compareByBalanceDesc({ balance: BALANCE_TINY }, { balance: BALANCE_TINY })).toBe(0);
  });

  test('should handle very large bigints', () => {
    const large1 = BigInt('999999999999999999999999999');
    const large2 = BigInt('999999999999999999999999998');
    expect(compareByBalanceDesc({ balance: large1 }, { balance: large2 })).toBe(-1);
  });
});

describe('filterAndSortTokensByBalance', () => {
  test('should filter out tokens with balance below minimum', () => {
    const token1 = createMockToken({ symbol: 'TOKEN1' });
    const token2 = createMockToken({ symbol: 'TOKEN2' });
    const destToken1 = createMockToken({ symbol: 'TOKEN1', chainName: 'chain1' });
    const destToken2 = createMockToken({ symbol: 'TOKEN2', chainName: 'chain2' });

    const tokens: TokensWithDestinationBalance[] = [
      { originToken: token1, destinationToken: destToken1, balance: BALANCE_TINY },
      { originToken: token2, destinationToken: destToken2, balance: BALANCE_MEDIUM },
    ];

    const result = filterAndSortTokensByBalance(tokens, BALANCE_SMALL);

    expect(result).toHaveLength(1);
    expect(result[0].originToken).toBe(token2);
  });

  test('should sort tokens by balance in descending order', () => {
    const token1 = createMockToken({ symbol: 'TOKEN1' });
    const token2 = createMockToken({ symbol: 'TOKEN2' });
    const token3 = createMockToken({ symbol: 'TOKEN3' });
    const destToken1 = createMockToken({ symbol: 'TOKEN1', chainName: 'chain1' });
    const destToken2 = createMockToken({ symbol: 'TOKEN2', chainName: 'chain2' });
    const destToken3 = createMockToken({ symbol: 'TOKEN3', chainName: 'chain3' });

    const tokens: TokensWithDestinationBalance[] = [
      { originToken: token1, destinationToken: destToken1, balance: BALANCE_TINY },
      { originToken: token2, destinationToken: destToken2, balance: BALANCE_SMALL },
      { originToken: token3, destinationToken: destToken3, balance: BigInt(300) },
    ];

    const result = filterAndSortTokensByBalance(tokens, BigInt(50));

    expect(result).toHaveLength(3);
    // Should be sorted: token2 (500) > token3 (300) > token1 (100)
    expect(result[0].originToken).toBe(token2);
    expect(result[0].balance).toBe(BALANCE_SMALL);
    expect(result[1].originToken).toBe(token3);
    expect(result[1].balance).toBe(BigInt(300));
    expect(result[2].originToken).toBe(token1);
    expect(result[2].balance).toBe(BALANCE_TINY);
  });

  test('should return empty array when no tokens meet minimum balance', () => {
    const token1 = createMockToken({ symbol: 'TOKEN1' });
    const destToken1 = createMockToken({ symbol: 'TOKEN1', chainName: 'chain1' });

    const tokens: TokensWithDestinationBalance[] = [
      { originToken: token1, destinationToken: destToken1, balance: BALANCE_TINY },
    ];

    const result = filterAndSortTokensByBalance(tokens, BALANCE_SMALL);

    expect(result).toHaveLength(0);
  });
});

describe('sortTokensByFee', () => {
  test('should return tokens with no fee before tokens with fee', () => {
    const token1 = createMockToken({ symbol: 'TOKEN1' });
    const token2 = createMockToken({ symbol: 'TOKEN2' });
    const feeToken = createMockToken({ symbol: 'FEE' });

    const tokenFees: TokenWithFee[] = [
      { token: token1, tokenFee: new TokenAmount(FEE_LOW, feeToken), balance: BALANCE_TINY },
      { token: token2, tokenFee: undefined, balance: BALANCE_TINY },
    ];

    const result = sortTokensByFee(tokenFees);

    expect(result[0].token).toBe(token2);
    expect(result[1].token).toBe(token1);
  });

  test('should sort tokens by fee amount (lowest first)', () => {
    const token1 = createMockToken({ symbol: 'TOKEN1' });
    const token2 = createMockToken({ symbol: 'TOKEN2' });
    const token3 = createMockToken({ symbol: 'TOKEN3' });
    const feeToken = createMockToken({ symbol: 'FEE' });

    const tokenFees: TokenWithFee[] = [
      { token: token1, tokenFee: new TokenAmount(FEE_HIGH, feeToken), balance: BALANCE_TINY },
      { token: token2, tokenFee: new TokenAmount(FEE_LOW, feeToken), balance: BALANCE_TINY },
      { token: token3, tokenFee: new TokenAmount(FEE_MEDIUM, feeToken), balance: BALANCE_TINY },
    ];

    const result = sortTokensByFee(tokenFees);

    expect(result[0].token).toBe(token2);
    expect(result[1].token).toBe(token3);
    expect(result[2].token).toBe(token1);
  });

  test('should use balance as tiebreaker when fees are equal', () => {
    const token1 = createMockToken({ symbol: 'TOKEN1' });
    const token2 = createMockToken({ symbol: 'TOKEN2' });
    const feeToken = createMockToken({ symbol: 'FEE' });

    const tokenFees: TokenWithFee[] = [
      { token: token1, tokenFee: new TokenAmount(FEE_LOW, feeToken), balance: BALANCE_TINY },
      { token: token2, tokenFee: new TokenAmount(FEE_LOW, feeToken), balance: BALANCE_SMALL },
    ];

    const result = sortTokensByFee(tokenFees);

    // Same fee, so token2 should come first (higher balance)
    expect(result[0].token).toBe(token2);
    expect(result[1].token).toBe(token1);
  });

  test('should use balance as tiebreaker when both have no fee', () => {
    const token1 = createMockToken({ symbol: 'TOKEN1' });
    const token2 = createMockToken({ symbol: 'TOKEN2' });

    const tokenFees: TokenWithFee[] = [
      { token: token1, tokenFee: undefined, balance: BALANCE_TINY },
      { token: token2, tokenFee: undefined, balance: BALANCE_SMALL },
    ];

    const result = sortTokensByFee(tokenFees);

    // Both no fee, so token2 should come first (higher balance)
    expect(result[0].token).toBe(token2);
    expect(result[1].token).toBe(token1);
  });

  test('should handle complex sorting with mixed fees and balances', () => {
    const token1 = createMockToken({ symbol: 'TOKEN1' });
    const token2 = createMockToken({ symbol: 'TOKEN2' });
    const token3 = createMockToken({ symbol: 'TOKEN3' });
    const token4 = createMockToken({ symbol: 'TOKEN4' });
    const feeToken = createMockToken({ symbol: 'FEE' });

    const tokenFees: TokenWithFee[] = [
      { token: token1, tokenFee: new TokenAmount(FEE_LOW, feeToken), balance: BALANCE_TINY }, // low fee, low balance
      { token: token2, tokenFee: undefined, balance: BigInt(200) }, // no fee, low balance
      { token: token3, tokenFee: new TokenAmount(FEE_LOW, feeToken), balance: BALANCE_SMALL }, // low fee, high balance
      { token: token4, tokenFee: undefined, balance: BigInt(800) }, // no fee, high balance
    ];

    const result = sortTokensByFee(tokenFees);

    // Expected order:
    // 1. token4 (no fee, high balance 800)
    // 2. token2 (no fee, low balance 200)
    // 3. token3 (fee 1000, high balance 500)
    // 4. token1 (fee 1000, low balance 100)
    expect(result[0].token).toBe(token4);
    expect(result[1].token).toBe(token2);
    expect(result[2].token).toBe(token3);
    expect(result[3].token).toBe(token1);
  });
});

describe('getTransferToken', () => {
  const createMockWarpCore = (
    overrides?: Partial<WarpCore>,
    originToken?: ReturnType<typeof createMockToken>,
  ) =>
    ({
      getTokenCollateral: vi.fn(),
      getInterchainTransferFee: vi.fn(),
      // Return the origin token from getTokensForRoute so findRouteToken can find a match
      getTokensForRoute: vi.fn().mockReturnValue(originToken ? [originToken] : []),
      ...overrides,
    }) as unknown as WarpCore;

  test('should return originToken if not a valid multi-collateral token', async () => {
    const originToken = createMockToken();
    const destinationToken = createMockToken();

    vi.spyOn(tokenUtils, 'isValidMultiCollateralToken').mockReturnValue(false);

    const result = await getTransferToken(
      createMockWarpCore({}, originToken),
      originToken,
      destinationToken,
      LARGE_TRANSFER_AMOUNT,
      MOCK_RECIPIENT,
      MOCK_SENDER,
    );

    expect(result).toBe(originToken);
  });

  test('should return originToken if only one token exists with same collateral', async () => {
    const originToken = createMockToken();
    const destinationToken = createMockToken();

    vi.spyOn(tokenUtils, 'isValidMultiCollateralToken').mockReturnValue(true);
    vi.spyOn(tokenUtils, 'getTokensWithSameCollateralAddresses').mockReturnValue([
      { originToken, destinationToken },
    ]);

    const result = await getTransferToken(
      createMockWarpCore({}, originToken),
      originToken,
      destinationToken,
      LARGE_TRANSFER_AMOUNT,
      MOCK_RECIPIENT,
      MOCK_SENDER,
    );

    expect(result).toBe(originToken);
  });

  test('should return originToken if no tokens have sufficient collateral balance', async () => {
    const originToken = createMockToken({ symbol: 'TOKEN1' });
    const destinationToken = createMockToken({ symbol: 'TOKEN1' });
    const originToken2 = createMockToken({ symbol: 'TOKEN2' });
    const destinationToken2 = createMockToken({ symbol: 'TOKEN2' });

    vi.spyOn(tokenUtils, 'isValidMultiCollateralToken').mockReturnValue(true);
    vi.spyOn(tokenUtils, 'getTokensWithSameCollateralAddresses').mockReturnValue([
      { originToken, destinationToken },
      { originToken: originToken2, destinationToken: destinationToken2 },
    ]);

    const warpCore = createMockWarpCore(
      {
        getTokenCollateral: vi.fn().mockResolvedValue(BALANCE_TINY),
      },
      originToken,
    );

    const result = await getTransferToken(
      warpCore,
      originToken,
      destinationToken,
      LARGE_TRANSFER_AMOUNT,
      MOCK_RECIPIENT,
      MOCK_SENDER,
    );

    expect(result).toBe(originToken);
  });

  test('should return first token with enough collateral if fee fetching fails for all', async () => {
    const originToken = createMockToken({ symbol: 'TOKEN1' });
    const destinationToken = createMockToken({ symbol: 'TOKEN1', chainName: 'chain1' });
    const originToken2 = createMockToken({ symbol: 'TOKEN2' });
    const destinationToken2 = createMockToken({ symbol: 'TOKEN2', chainName: 'chain2' });

    vi.spyOn(tokenUtils, 'isValidMultiCollateralToken').mockReturnValue(true);
    vi.spyOn(tokenUtils, 'getTokensWithSameCollateralAddresses').mockReturnValue([
      { originToken, destinationToken },
      { originToken: originToken2, destinationToken: destinationToken2 },
    ]);

    const warpCore = createMockWarpCore(
      {
        getTokenCollateral: vi
          .fn()
          .mockResolvedValueOnce(BALANCE_LARGE)
          .mockResolvedValueOnce(BALANCE_XLARGE),
        getInterchainTransferFee: vi.fn().mockRejectedValue(new Error('Fee fetch failed')),
      },
      originToken,
    );

    const result = await getTransferToken(
      warpCore,
      originToken,
      destinationToken,
      TRANSFER_AMOUNT,
      MOCK_RECIPIENT,
      MOCK_SENDER,
    );

    // Should return the token with highest collateral balance
    expect(result).toBe(originToken2);
  });

  test('should return token with lowest fee when multiple routes available', async () => {
    const originToken = createMockToken({ symbol: 'TOKEN1' });
    const destinationToken = createMockToken({ symbol: 'TOKEN1', chainName: 'chain1' });
    const originToken2 = createMockToken({ symbol: 'TOKEN2' });
    const destinationToken2 = createMockToken({ symbol: 'TOKEN2', chainName: 'chain2' });

    vi.spyOn(tokenUtils, 'isValidMultiCollateralToken').mockReturnValue(true);
    vi.spyOn(tokenUtils, 'getTokensWithSameCollateralAddresses').mockReturnValue([
      { originToken, destinationToken },
      { originToken: originToken2, destinationToken: destinationToken2 },
    ]);

    const feeToken = createMockToken({ symbol: 'FEE' });

    const warpCore = createMockWarpCore(
      {
        getTokenCollateral: vi.fn().mockResolvedValue(BALANCE_XLARGE),
        getInterchainTransferFee: vi
          .fn()
          .mockResolvedValueOnce({ tokenFeeQuote: new TokenAmount(FEE_HIGH, feeToken) })
          .mockResolvedValueOnce({ tokenFeeQuote: new TokenAmount(FEE_LOW, feeToken) }),
      },
      originToken,
    );

    const result = await getTransferToken(
      warpCore,
      originToken,
      destinationToken,
      TRANSFER_AMOUNT,
      MOCK_RECIPIENT,
      MOCK_SENDER,
    );

    expect(result).toBe(originToken2);
  });

  test('should prefer route with no fee over route with fee', async () => {
    const originToken = createMockToken({ symbol: 'TOKEN1' });
    const destinationToken = createMockToken({ symbol: 'TOKEN1', chainName: 'chain1' });
    const originToken2 = createMockToken({ symbol: 'TOKEN2' });
    const destinationToken2 = createMockToken({ symbol: 'TOKEN2', chainName: 'chain2' });

    vi.spyOn(tokenUtils, 'isValidMultiCollateralToken').mockReturnValue(true);
    vi.spyOn(tokenUtils, 'getTokensWithSameCollateralAddresses').mockReturnValue([
      { originToken, destinationToken },
      { originToken: originToken2, destinationToken: destinationToken2 },
    ]);

    const feeToken = createMockToken({ symbol: 'FEE' });

    const warpCore = createMockWarpCore(
      {
        getTokenCollateral: vi.fn().mockResolvedValue(BALANCE_XLARGE),
        getInterchainTransferFee: vi
          .fn()
          .mockResolvedValueOnce({ tokenFeeQuote: new TokenAmount(FEE_LOW, feeToken) })
          .mockResolvedValueOnce({ tokenFeeQuote: undefined }),
      },
      originToken,
    );

    const result = await getTransferToken(
      warpCore,
      originToken,
      destinationToken,
      TRANSFER_AMOUNT,
      MOCK_RECIPIENT,
      MOCK_SENDER,
    );

    expect(result).toBe(originToken2);
  });

  test('should handle collateral fetch failure gracefully', async () => {
    const originToken = createMockToken({ symbol: 'TOKEN1' });
    const destinationToken = createMockToken({ symbol: 'TOKEN1', chainName: 'chain1' });
    const originToken2 = createMockToken({ symbol: 'TOKEN2' });
    const destinationToken2 = createMockToken({ symbol: 'TOKEN2', chainName: 'chain2' });

    vi.spyOn(tokenUtils, 'isValidMultiCollateralToken').mockReturnValue(true);
    vi.spyOn(tokenUtils, 'getTokensWithSameCollateralAddresses').mockReturnValue([
      { originToken, destinationToken },
      { originToken: originToken2, destinationToken: destinationToken2 },
    ]);

    const feeToken = createMockToken({ symbol: 'FEE' });

    const warpCore = createMockWarpCore(
      {
        getTokenCollateral: vi
          .fn()
          .mockRejectedValueOnce(new Error('Failed to fetch collateral'))
          .mockResolvedValueOnce(BALANCE_XXLARGE),
        getInterchainTransferFee: vi.fn().mockResolvedValue({
          tokenFeeQuote: new TokenAmount(FEE_LOW, feeToken),
        }),
      },
      originToken,
    );

    const result = await getTransferToken(
      warpCore,
      originToken,
      destinationToken,
      TRANSFER_AMOUNT,
      MOCK_RECIPIENT,
      MOCK_SENDER,
    );

    expect(result).toBe(originToken2);
  });

  test('should handle fee fetch failure for some routes gracefully', async () => {
    const originToken = createMockToken({ symbol: 'TOKEN1' });
    const destinationToken = createMockToken({ symbol: 'TOKEN1', chainName: 'chain1' });
    const originToken2 = createMockToken({ symbol: 'TOKEN2' });
    const destinationToken2 = createMockToken({ symbol: 'TOKEN2', chainName: 'chain2' });

    vi.spyOn(tokenUtils, 'isValidMultiCollateralToken').mockReturnValue(true);
    vi.spyOn(tokenUtils, 'getTokensWithSameCollateralAddresses').mockReturnValue([
      { originToken, destinationToken },
      { originToken: originToken2, destinationToken: destinationToken2 },
    ]);

    const feeToken = createMockToken({ symbol: 'FEE' });

    const warpCore = createMockWarpCore(
      {
        getTokenCollateral: vi.fn().mockResolvedValue(BALANCE_XXLARGE),
        getInterchainTransferFee: vi
          .fn()
          .mockRejectedValueOnce(new Error('Fee fetch failed'))
          .mockResolvedValueOnce({ tokenFeeQuote: new TokenAmount(FEE_LOW, feeToken) }),
      },
      originToken,
    );

    const result = await getTransferToken(
      warpCore,
      originToken,
      destinationToken,
      TRANSFER_AMOUNT,
      MOCK_RECIPIENT,
      MOCK_SENDER,
    );

    expect(result).toBe(originToken2);
  });

  test('should return default token when configured in defaultMultiCollateralRoutes', async () => {
    const originToken = createMockToken({
      symbol: 'USDC',
      chainName: 'ethereum',
      collateralAddressOrDenom: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    });
    const destinationToken = createMockToken({
      symbol: 'USDC',
      chainName: 'arbitrum',
      collateralAddressOrDenom: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    });
    const defaultOriginToken = createMockToken({
      symbol: 'USDC',
      addressOrDenom: '0xe1De9910fe71cC216490AC7FCF019e13a34481D7',
      chainName: 'ethereum',
      collateralAddressOrDenom: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    });
    const defaultDestToken = createMockToken({
      symbol: 'USDC',
      addressOrDenom: '0xAd4350Ee0f9f5b85BaB115425426086Ae8384ebb',
      chainName: 'arbitrum',
      collateralAddressOrDenom: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    });

    vi.spyOn(tokenUtils, 'isValidMultiCollateralToken').mockReturnValue(true);
    vi.spyOn(tokenUtils, 'getTokensWithSameCollateralAddresses').mockReturnValue([
      { originToken, destinationToken },
      { originToken: defaultOriginToken, destinationToken: defaultDestToken },
    ]);

    const defaultRoutes = {
      ethereum: {
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': '0xe1De9910fe71cC216490AC7FCF019e13a34481D7',
      },
      arbitrum: {
        '0xaf88d065e77c8cC2239327C5EDb3A432268e5831': '0xAd4350Ee0f9f5b85BaB115425426086Ae8384ebb',
      },
    };

    const warpCore = createMockWarpCore(
      {
        // These should NOT be called because default route bypasses fee lookup
        getTokenCollateral: vi.fn(),
        getInterchainTransferFee: vi.fn(),
      },
      originToken,
    );

    const result = await getTransferToken(
      warpCore,
      originToken,
      destinationToken,
      TRANSFER_AMOUNT,
      MOCK_RECIPIENT,
      MOCK_SENDER,
      defaultRoutes,
    );

    expect(result).toBe(defaultOriginToken);
    // Verify fee lookup was not called (bypassed)
    expect(warpCore.getTokenCollateral).not.toHaveBeenCalled();
    expect(warpCore.getInterchainTransferFee).not.toHaveBeenCalled();
  });

  test('should fall back to fee-based selection when default token not found in same collateral addresses', async () => {
    const originToken = createMockToken({
      symbol: 'USDC',
      chainName: 'ethereum',
      collateralAddressOrDenom: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    });
    const destinationToken = createMockToken({
      symbol: 'USDC',
      chainName: 'arbitrum',
      collateralAddressOrDenom: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    });
    const originToken2 = createMockToken({
      symbol: 'USDC',
      addressOrDenom: '0xDifferentWarpRoute',
      chainName: 'ethereum',
      collateralAddressOrDenom: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    });
    const destinationToken2 = createMockToken({
      symbol: 'USDC',
      addressOrDenom: '0xDifferentDestWarpRoute',
      chainName: 'arbitrum',
      collateralAddressOrDenom: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    });

    vi.spyOn(tokenUtils, 'isValidMultiCollateralToken').mockReturnValue(true);
    // tokensWithSameCollateralAddresses does NOT include the default token addressOrDenom
    vi.spyOn(tokenUtils, 'getTokensWithSameCollateralAddresses').mockReturnValue([
      { originToken, destinationToken },
      { originToken: originToken2, destinationToken: destinationToken2 },
    ]);

    // Default routes are configured but point to addresses not in tokensWithSameCollateralAddresses
    const defaultRoutes = {
      ethereum: {
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': '0xNonExistentWarpRoute',
      },
      arbitrum: {
        '0xaf88d065e77c8cC2239327C5EDb3A432268e5831': '0xNonExistentDestWarpRoute',
      },
    };

    const feeToken = createMockToken({ symbol: 'FEE' });

    const warpCore = createMockWarpCore(
      {
        getTokenCollateral: vi.fn().mockResolvedValue(BALANCE_XLARGE),
        getInterchainTransferFee: vi
          .fn()
          .mockResolvedValueOnce({ tokenFeeQuote: new TokenAmount(FEE_HIGH, feeToken) })
          .mockResolvedValueOnce({ tokenFeeQuote: new TokenAmount(FEE_LOW, feeToken) }),
      },
      originToken,
    );

    const result = await getTransferToken(
      warpCore,
      originToken,
      destinationToken,
      TRANSFER_AMOUNT,
      MOCK_RECIPIENT,
      MOCK_SENDER,
      defaultRoutes,
    );

    // Should fall back to fee-based selection and return token2 (lowest fee)
    expect(result).toBe(originToken2);
    // Verify fee lookup WAS called (fallback behavior)
    expect(warpCore.getTokenCollateral).toHaveBeenCalled();
  });
});
