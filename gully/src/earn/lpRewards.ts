/**
 * Bridge & Earn live numbers from the Gully Chain indexer (SPEC-bridge-and-earn, "Indexer REST"):
 * - GET /rewards/lp/stats -> { live, totalWeightUsd, participants, activePositions, distributedUsd, claimedUsd,
 *   ratePerDayUsd, daysLeft, claimDeadline, updatedAt } (compact card numbers, polled every 30 s)
 * - GET /rewards/lp -> { ..., series: [{ t, totalWeight, activePositions, distributedUsd, claimedUsd }] } (hourly,
 *   cumulative; fetched only while the program is live, every 5 min, for the sparkline)
 * One poll loop for the whole page (useSyncExternalStore, like bridge/usd.ts). The endpoints are not deployed yet: a
 * 404, a non-JSON body or a network error all become `live: false` ("not live yet"), never an error on screen.
 */
import { useSyncExternalStore } from 'react';

import { INDEXER_URL } from '../config/indexer';

export interface LpStats {
  live: boolean;
  totalWeightUsd: number;
  participants: number;
  activePositions: number;
  distributedUsd: number;
  claimedUsd: number;
  ratePerDayUsd: number;
  daysLeft: number;
  /** unix seconds, null when unknown */
  claimDeadline: number | null;
  /** unix seconds, null when unknown */
  updatedAt: number | null;
}

export interface LpSeriesPoint {
  /** hour start, unix seconds */
  t: number;
  totalWeight: number;
  activePositions: number;
  /** cumulative */
  distributedUsd: number;
  /** cumulative */
  claimedUsd: number;
}

export const STATS_INTERVAL_MS = 30_000;
export const SERIES_INTERVAL_MS = 5 * 60_000;
export const FETCH_TIMEOUT_MS = 8_000;

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** The /rewards/lp/stats body (numbers or decimal strings); null when it is not that shape. `live` must be exactly true. */
export function parseLpStats(json: unknown): LpStats | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  if (typeof o.live !== 'boolean') return null;
  return {
    live: o.live === true,
    totalWeightUsd: num(o.totalWeightUsd),
    participants: num(o.participants),
    activePositions: num(o.activePositions),
    distributedUsd: num(o.distributedUsd),
    claimedUsd: num(o.claimedUsd),
    ratePerDayUsd: num(o.ratePerDayUsd),
    daysLeft: num(o.daysLeft),
    claimDeadline: numOrNull(o.claimDeadline),
    updatedAt: numOrNull(o.updatedAt),
  };
}

/** The `series` of /rewards/lp, sorted by time; [] when absent. */
export function parseLpSeries(json: unknown): LpSeriesPoint[] {
  const s = (json as { series?: unknown } | null)?.series;
  if (!Array.isArray(s)) return [];
  return s
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => ({ t: num(p.t), totalWeight: num(p.totalWeight), activePositions: num(p.activePositions), distributedUsd: num(p.distributedUsd), claimedUsd: num(p.claimedUsd) }))
    .filter((p) => p.t > 0)
    .sort((a, b) => a.t - b.t);
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

async function getJson(url: string, fetchImpl: FetchLike): Promise<unknown | null> {
  const r = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: 'application/json' } });
  if (r.status === 404) return null; // endpoint not deployed: not live
  if (!r.ok) throw new Error(`indexer ${r.status}`);
  return r.json();
}

/** Stats, or null when the endpoint does not exist (404) or does not answer in the expected shape. Throws on other failures. */
export async function fetchLpStats(base: string = INDEXER_URL, fetchImpl: FetchLike = fetch): Promise<LpStats | null> {
  const json = await getJson(`${base}/rewards/lp/stats`, fetchImpl);
  return json === null ? null : parseLpStats(json);
}

export async function fetchLpSeries(base: string = INDEXER_URL, fetchImpl: FetchLike = fetch): Promise<LpSeriesPoint[]> {
  const json = await getJson(`${base}/rewards/lp`, fetchImpl);
  return json === null ? [] : parseLpSeries(json);
}

// ---------------------------------------------------------------- live store (one poll loop for the app)

export interface LpRewardsSnapshot {
  /** true until the first answer (or failure) */
  loading: boolean;
  /** program live: contract has code and start <= now, per the indexer */
  live: boolean;
  stats: LpStats | null;
  /** hourly points (cumulative), null until fetched */
  series: LpSeriesPoint[] | null;
  /** last fetch problem (shown nowhere; the card falls back to "not live yet") */
  error: string | null;
  /** ms of the last successful stats answer */
  updatedAt: number;
}

export const INITIAL_SNAPSHOT: LpRewardsSnapshot = { loading: true, live: false, stats: null, series: null, error: null, updatedAt: 0 };

let snap: LpRewardsSnapshot = INITIAL_SNAPSHOT;
let seriesAt = 0;
let inflight: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function publish(next: Partial<LpRewardsSnapshot>) {
  snap = { ...snap, ...next };
  for (const l of listeners) l();
}

/** One refresh: stats always; the series only while live and at most every 5 min. Never rejects. */
export function refreshLpRewards(base: string = INDEXER_URL, fetchImpl: FetchLike = fetch): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const stats = await fetchLpStats(base, fetchImpl);
      const live = stats?.live === true;
      publish({ loading: false, live, stats, error: null, updatedAt: Date.now(), series: live ? snap.series : null });
      if (live && Date.now() - seriesAt > SERIES_INTERVAL_MS) {
        try {
          const series = await fetchLpSeries(base, fetchImpl);
          seriesAt = Date.now();
          publish({ series });
        } catch {
          /* the sparkline just stays as it was */
        }
      }
    } catch (e) {
      publish({ loading: false, live: false, error: (e as Error).message || 'offline' });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!timer && typeof window !== 'undefined') {
    void refreshLpRewards();
    timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void refreshLpRewards();
    }, STATS_INTERVAL_MS);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => snap;
/** The current snapshot outside React (tests, analytics). */
export const readLpRewards = getSnapshot;

/** Live Bridge & Earn numbers for any component; the first subscriber starts the 30 s poll, the last one stops it. */
export function useLpRewardsStats(): LpRewardsSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test hook: reset (or preset) the store. */
export function resetLpRewardsStore(preset: Partial<LpRewardsSnapshot> = {}) {
  snap = { ...INITIAL_SNAPSHOT, ...preset };
  seriesAt = 0;
  inflight = null;
  if (timer) clearInterval(timer);
  timer = null;
  for (const l of listeners) l();
}
