import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockToken } from '../../utils/test';
import { getTotalFee } from './fees';

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

    const result = getTotalFee({
      interchainQuote,
      localQuote,
    });

    expect(result).toHaveLength(1);
    expect(result[0].token).toEqual(token1);
    expect(result[0].amount).toEqual(BigInt('1500000000000000000'));
  });

  test('should separate non-fungible tokens with same symbol', () => {
    const token1 = createMockToken({
      symbol: 'ETH',
      decimals: 18,
      chainName: 'ethereum',
    });
    const token2 = createMockToken({
      symbol: 'ETH',
      decimals: 18,
      chainName: 'polygon',
    });

    // Mock isFungibleWith to return false for different chain tokens
    vi.spyOn(token1, 'isFungibleWith').mockReturnValue(false);

    const interchainQuote = token1.amount('1000000000000000000');
    const localQuote = token2.amount('500000000000000000');

    const result = getTotalFee({
      interchainQuote,
      localQuote,
    });

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

    const result = getTotalFee({
      interchainQuote,
      localQuote,
      tokenFeeQuote,
    });

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

    const result = getTotalFee({
      interchainQuote,
      localQuote,
      tokenFeeQuote,
    });

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

    const result = getTotalFee({
      interchainQuote,
      localQuote,
      tokenFeeQuote: undefined,
    });

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

    const result = getTotalFee({
      interchainQuote,
      localQuote,
    });

    expect(result).toHaveLength(1);
    expect(result[0].token).toEqual(ethToken1);
    expect(result[0].amount).toEqual(BigInt('1000000000000000000'));
  });

  test('should handle large numbers correctly', () => {
    const ethToken1 = createMockToken({ symbol: 'ETH', decimals: 18 });
    const ethToken2 = createMockToken({ symbol: 'ETH', decimals: 18 });

    vi.spyOn(ethToken1, 'isFungibleWith').mockReturnValue(true);

    const largeAmount1 = '999999999999999999999999999'; // Very large amount
    const largeAmount2 = '1000000000000000000000000000'; // Another very large amount

    const interchainQuote = ethToken1.amount(largeAmount1);
    const localQuote = ethToken2.amount(largeAmount2);

    const result = getTotalFee({
      interchainQuote,
      localQuote,
    });

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

    const result = getTotalFee({
      interchainQuote,
      localQuote,
      tokenFeeQuote,
    });

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

    const result = getTotalFee({
      interchainQuote,
      localQuote,
      tokenFeeQuote,
    });

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

    // Mock all tokens to be fungible with each other
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

    const result = getTotalFee({
      interchainQuote,
      localQuote,
      tokenFeeQuote,
    });

    expect(result).toHaveLength(1);
    expect(result[0].token).toEqual(token1);
    expect(result[0].amount).toEqual(BigInt('6000000'));
  });
});
