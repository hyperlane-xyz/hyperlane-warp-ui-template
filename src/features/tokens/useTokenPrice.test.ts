import { afterEach, describe, expect, test, vi } from 'vitest';

import { useStore } from '../store';
import { getFreshTokenUsdValue, schedulePriceExpiry } from './useTokenPrice';

const NOW = 2_000_000_000_000;
const initialTokenPrices = useStore.getState().tokenPrices;

afterEach(() => {
  useStore.setState({ tokenPrices: initialTokenPrices });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('getFreshTokenUsdValue', () => {
  test('returns the USD value for a fresh price', () => {
    expect(getFreshTokenUsdValue({ usd: 2, fetchedAt: NOW - 1_000 }, '3', NOW)).toBe(6);
  });

  test('returns null for a stale price', () => {
    expect(getFreshTokenUsdValue({ usd: 2, fetchedAt: NOW - 16 * 60_000 }, '3', NOW)).toBeNull();
  });

  test('returns null after a failed refresh retains the cached price', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    useStore.setState({
      tokenPrices: { ethereum: { usd: 2, fetchedAt: NOW - 1_000 } },
    });

    useStore.getState().mergeTokenPrices([], {}, ['ethereum']);

    const entry = useStore.getState().tokenPrices.ethereum;
    expect(entry).toEqual({ usd: 2, fetchedAt: NOW - 1_000, failedAt: NOW });
    expect(getFreshTokenUsdValue(entry, '3', NOW)).toBeNull();
  });

  test('expires a fresh value without a price-entry mutation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const entry = { usd: 2, fetchedAt: NOW };
    let value = getFreshTokenUsdValue(entry, '3');

    schedulePriceExpiry(entry.fetchedAt, () => {
      value = getFreshTokenUsdValue(entry, '3');
    });
    vi.advanceTimersByTime(15 * 60_000 - 1);
    expect(value).toBe(6);

    vi.advanceTimersByTime(1);
    expect(value).toBeNull();
  });
});
