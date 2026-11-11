/**
 * Gully Chain indexer (Ponder, gully-ops l3/indexer): REST, JSON, bigints as decimal strings, CORS *.
 * Bridge & Earn reads GET /rewards/lp/stats (card numbers) and GET /rewards/lp (hourly series) from it.
 * VITE_GULLY_INDEXER_URL overrides the host (local tunnel, staging). The /rewards/lp endpoints are not live yet
 * (2026-10-30): a 404 or a network error means "Bridge & Earn is not live on testnet yet", never a broken card.
 * The host must stay in connect-src of deploy/Caddyfile.bridge.
 */
export const DEFAULT_INDEXER_URL = 'https://indexer.gullychain.xyz';

/** Indexer base URL without a trailing slash; only http(s) values from the env are accepted. */
export function indexerUrl(env: Record<string, unknown> = import.meta.env): string {
  const raw = typeof env.VITE_GULLY_INDEXER_URL === 'string' ? env.VITE_GULLY_INDEXER_URL.trim() : '';
  if (!/^https?:\/\//.test(raw)) return DEFAULT_INDEXER_URL;
  return raw.replace(/\/+$/, '');
}

export const INDEXER_URL = indexerUrl();
