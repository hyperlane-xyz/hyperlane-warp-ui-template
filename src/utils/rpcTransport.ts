import { Transport, fallback, http } from 'viem';

// Ranking makes viem's fallback transport periodically sample each RPC and reorder
// them by stability (success rate) and latency. A faulty endpoint — e.g. one returning
// HTTP 429 rate limits — is demoted so healthy endpoints are tried first, instead of
// re-hitting the same faulty primary on every request (viem's default rank:false).
// Interval is widened from the 4s default to reduce background ping load on public RPCs.
const RANK_OPTIONS = { interval: 10_000 } as const;

export function rankedFallbackTransport(httpUrls: string[]): Transport {
  return fallback(
    httpUrls.map((url) => http(url)),
    { rank: RANK_OPTIONS },
  );
}
