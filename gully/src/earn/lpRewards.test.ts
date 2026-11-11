import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_INDEXER_URL, indexerUrl } from '../config/indexer';
import { fetchLpStats, parseLpSeries, parseLpStats, readLpRewards, refreshLpRewards, resetLpRewardsStore } from './lpRewards';

const STATS = {
  live: true,
  totalWeightUsd: '12345.5',
  participants: 42,
  activePositions: '57',
  distributedUsd: 1234.5,
  claimedUsd: '800',
  ratePerDayUsd: 61.7,
  daysLeft: 23,
  claimDeadline: 1777334400,
  updatedAt: 1761800000,
};

const json = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const calls: string[] = [];
const router = (routes: Record<string, () => Promise<Response>>) => async (url: string) => {
  calls.push(url);
  const path = new URL(url).pathname;
  const h = routes[path];
  if (!h) return new Response('not found', { status: 404 });
  return h();
};

afterEach(() => {
  resetLpRewardsStore();
  calls.length = 0;
});

describe('indexer config', () => {
  it('defaults to the public indexer; env must be http(s); trailing slash dropped', () => {
    expect(indexerUrl({})).toBe(DEFAULT_INDEXER_URL);
    expect(indexerUrl({ VITE_GULLY_INDEXER_URL: 'http://127.0.0.1:42069/' })).toBe('http://127.0.0.1:42069');
    expect(indexerUrl({ VITE_GULLY_INDEXER_URL: 'ftp://x' })).toBe(DEFAULT_INDEXER_URL);
  });
});

describe('parseLpStats / parseLpSeries', () => {
  it('reads numbers and decimal strings; live must be a boolean', () => {
    const s = parseLpStats(STATS)!;
    expect(s.live).toBe(true);
    expect(s.totalWeightUsd).toBe(12345.5);
    expect(s.activePositions).toBe(57);
    expect(s.claimedUsd).toBe(800);
    expect(s.claimDeadline).toBe(1777334400);
    expect(parseLpStats({ ...STATS, live: 'yes' })).toBeNull();
    expect(parseLpStats(null)).toBeNull();
    expect(parseLpStats([])).toBeNull();
    expect(parseLpStats({ live: false })!.live).toBe(false);
    expect(parseLpStats({ live: false, claimDeadline: null })!.claimDeadline).toBeNull();
  });
  it('series: sorted by time, bad points dropped, [] when absent', () => {
    expect(parseLpSeries({ series: [{ t: 2, distributedUsd: '5' }, { t: 1, distributedUsd: 1 }, null, { t: 0 }] })).toEqual([
      { t: 1, totalWeight: 0, activePositions: 0, distributedUsd: 1, claimedUsd: 0 },
      { t: 2, totalWeight: 0, activePositions: 0, distributedUsd: 5, claimedUsd: 0 },
    ]);
    expect(parseLpSeries({})).toEqual([]);
    expect(parseLpSeries(null)).toEqual([]);
  });
});

describe('fetchLpStats', () => {
  it('404 (endpoint not deployed yet) is null, not an error', async () => {
    expect(await fetchLpStats('https://indexer.test', router({}))).toBeNull();
    expect(calls).toEqual(['https://indexer.test/rewards/lp/stats']);
  });
  it('other HTTP errors throw', async () => {
    await expect(fetchLpStats('https://indexer.test', router({ '/rewards/lp/stats': json({ error: 'x' }, 500) }))).rejects.toThrow('indexer 500');
  });
  it('a good answer is parsed', async () => {
    const s = await fetchLpStats('https://indexer.test', router({ '/rewards/lp/stats': json(STATS) }));
    expect(s?.participants).toBe(42);
  });
});

describe('live store', () => {
  it('starts loading, not live', () => {
    expect(readLpRewards()).toMatchObject({ loading: true, live: false, stats: null, series: null });
  });
  it('network failure -> not live, loading done, error kept quietly', async () => {
    await refreshLpRewards('https://indexer.test', async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(readLpRewards()).toMatchObject({ loading: false, live: false, stats: null, error: 'Failed to fetch' });
  });
  it('404 -> not live, no error', async () => {
    await refreshLpRewards('https://indexer.test', router({}));
    expect(readLpRewards()).toMatchObject({ loading: false, live: false, stats: null, error: null });
  });
  it('live program -> stats and the hourly series', async () => {
    const series = [
      { t: 1761796800, distributedUsd: 0 },
      { t: 1761800400, distributedUsd: 10 },
      { t: 1761804000, distributedUsd: 25 },
    ];
    await refreshLpRewards('https://indexer.test', router({ '/rewards/lp/stats': json(STATS), '/rewards/lp': json({ live: true, series }) }));
    const s = readLpRewards();
    expect(s.loading).toBe(false);
    expect(s.live).toBe(true);
    expect(s.stats?.distributedUsd).toBe(1234.5);
    expect(s.series?.map((p) => p.distributedUsd)).toEqual([0, 10, 25]);
    expect(calls).toEqual(['https://indexer.test/rewards/lp/stats', 'https://indexer.test/rewards/lp']);
  });
  it('program not started (live false) -> no series request, series cleared', async () => {
    await refreshLpRewards('https://indexer.test', router({ '/rewards/lp/stats': json({ ...STATS, live: false }) }));
    expect(readLpRewards()).toMatchObject({ loading: false, live: false, series: null });
    expect(readLpRewards().stats?.live).toBe(false);
    expect(calls).toEqual(['https://indexer.test/rewards/lp/stats']);
  });
});
