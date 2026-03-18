import { TokenAmount } from '@hyperlane-xyz/sdk';
import { describe, expect, test } from 'vitest';
import { createMockToken } from '../../utils/test';
import {
  getFeePercentage,
  getTotalFeesUsd,
  getTotalFeesUsdRaw,
  getUsdDisplayForFee,
} from './feeUsdDisplay';
import { FeePrices } from './useFeePrices';

const ethToken = createMockToken({ symbol: 'ETH', decimals: 18 });

function makeAmount(token: typeof ethToken, wei: bigint) {
  return new TokenAmount(wei, token);
}

const prices: FeePrices = { ETH: 2000, SOL: 100 };

describe('getUsdDisplayForFee', () => {
  test('returns null for undefined tokenAmount', () => {
    expect(getUsdDisplayForFee(undefined, prices)).toBeNull();
  });

  test('returns null for zero amount', () => {
    expect(getUsdDisplayForFee(makeAmount(ethToken, 0n), prices)).toBeNull();
  });

  test('returns null when no price available', () => {
    const unknown = createMockToken({ symbol: 'UNKNOWN', decimals: 18 });
    expect(getUsdDisplayForFee(makeAmount(unknown, 10n ** 18n), prices)).toBeNull();
  });

  test('returns formatted USD for valid amount', () => {
    // 1 ETH at $2000 = $2000.00
    expect(getUsdDisplayForFee(makeAmount(ethToken, 10n ** 18n), prices)).toBe('≈$2,000.00');
  });

  test('returns <$0.01 for very small amounts', () => {
    // 1 wei ETH is effectively $0
    expect(getUsdDisplayForFee(makeAmount(ethToken, 1n), prices)).toBe('<$0.01');
  });
});

describe('getTotalFeesUsdRaw', () => {
  test('sums all priced fees', () => {
    const fees = {
      localQuote: makeAmount(ethToken, 10n ** 16n), // 0.01 ETH = $20
      interchainQuote: makeAmount(ethToken, 5n * 10n ** 16n), // 0.05 ETH = $100
    };
    expect(getTotalFeesUsdRaw(fees, prices)).toBeCloseTo(120);
  });

  test('skips fees without price', () => {
    const unknown = createMockToken({ symbol: 'UNKNOWN', decimals: 18 });
    const fees = {
      localQuote: makeAmount(unknown, 10n ** 18n),
      interchainQuote: makeAmount(ethToken, 10n ** 16n), // 0.01 ETH = $20
    };
    expect(getTotalFeesUsdRaw(fees, prices)).toBeCloseTo(20);
  });

  test('returns 0 when no fees have prices', () => {
    const unknown = createMockToken({ symbol: 'UNKNOWN', decimals: 18 });
    const fees = {
      localQuote: makeAmount(unknown, 10n ** 18n),
      interchainQuote: makeAmount(unknown, 10n ** 18n),
    };
    expect(getTotalFeesUsdRaw(fees, prices)).toBe(0);
  });
});

describe('getTotalFeesUsd', () => {
  test('returns formatted total', () => {
    const fees = {
      localQuote: makeAmount(ethToken, 10n ** 16n),
      interchainQuote: makeAmount(ethToken, 10n ** 16n),
    };
    expect(getTotalFeesUsd(fees, prices)).toBe('≈$40.00');
  });

  test('returns null when total is 0', () => {
    const fees = {
      localQuote: makeAmount(ethToken, 0n),
      interchainQuote: makeAmount(ethToken, 0n),
    };
    expect(getTotalFeesUsd(fees, prices)).toBeNull();
  });
});

describe('getFeePercentage', () => {
  test('returns null when totalFeesUsd is 0', () => {
    expect(getFeePercentage(0, 1000)).toBeNull();
  });

  test('returns null when transferUsd is 0', () => {
    expect(getFeePercentage(10, 0)).toBeNull();
  });

  test('returns formatted percentage', () => {
    expect(getFeePercentage(1, 1000)).toBe('0.10%');
  });

  test('returns <0.01% for tiny percentages', () => {
    expect(getFeePercentage(0.001, 1000)).toBe('<0.01%');
  });

  test('returns ≥100% when fees exceed transfer', () => {
    expect(getFeePercentage(1500, 1000)).toBe('≥100%');
  });

  test('returns ≥100% when fees equal transfer', () => {
    expect(getFeePercentage(1000, 1000)).toBe('≥100%');
  });
});
