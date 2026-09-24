import { afterEach, describe, expect, test, vi } from 'vitest';

import { getFreshTokenUsdValue, PRICE_CACHE_MS, schedulePriceExpiry } from './useTokenPrice';

const NOW = 2_000_000_000_000;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('getFreshTokenUsdValue', () => {
  test('returns the USD value for a fresh price', () => {
    expect(getFreshTokenUsdValue({ usd: 2, fetchedAt: NOW - 1_000 }, '3', NOW)).toBe(6);
  });

  test('expires exactly at the freshness boundary', () => {
    expect(getFreshTokenUsdValue({ usd: 2, fetchedAt: NOW - PRICE_CACHE_MS + 1 }, '3', NOW)).toBe(
      6,
    );
    expect(getFreshTokenUsdValue({ usd: 2, fetchedAt: NOW - PRICE_CACHE_MS }, '3', NOW)).toBeNull();
  });

  test('rejects a failed refresh and allows a later successful refresh', () => {
    expect(
      getFreshTokenUsdValue({ usd: 2, fetchedAt: NOW - 1_000, failedAt: NOW - 1_000 }, '3', NOW),
    ).toBeNull();
    expect(
      getFreshTokenUsdValue({ usd: 2, fetchedAt: NOW - 1_000, failedAt: NOW - 90_000 }, '3', NOW),
    ).toBe(6);
  });

  test('returns null when the price entry or price is unavailable', () => {
    expect(getFreshTokenUsdValue(undefined, '3', NOW)).toBeNull();
    expect(getFreshTokenUsdValue({ fetchedAt: NOW - 1_000 }, '3', NOW)).toBeNull();
    expect(getFreshTokenUsdValue({ usd: 0, fetchedAt: NOW - 1_000 }, '3', NOW)).toBeNull();
  });

  test('prices amounts containing grouping separators', () => {
    expect(getFreshTokenUsdValue({ usd: 2, fetchedAt: NOW - 1_000 }, '1,234.56', NOW)).toBe(
      2_469.12,
    );
  });

  test('expires a fresh value without a price-entry mutation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const entry = { usd: 2, fetchedAt: NOW };
    let value = getFreshTokenUsdValue(entry, '3');

    schedulePriceExpiry(entry.fetchedAt, () => {
      value = getFreshTokenUsdValue(entry, '3');
    });
    vi.advanceTimersByTime(PRICE_CACHE_MS - 1);
    expect(value).toBe(6);

    vi.advanceTimersByTime(1);
    expect(value).toBeNull();
  });
});
