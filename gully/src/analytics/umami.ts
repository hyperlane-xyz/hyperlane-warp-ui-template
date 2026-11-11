/**
 * Gully analytics: the one self-hosted Umami at analytics.gullylabs.xyz. The loader tag in index.html
 * is cookieless and honours Do Not Track, so there is no consent banner (gullychain.xyz/privacy).
 * `track` is a no-op when the script is blocked or missing. Props are coarse labels only: never an address or email.
 */
type Props = Record<string, string | number | boolean>;

const ADDR = /0x[0-9a-fA-F]{40}/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export function safeProps(data?: Props): Props | undefined {
  if (!data) return undefined;
  const out: Props = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string' && (ADDR.test(v) || EMAIL.test(v) || v.length > 64)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function track(event: string, data?: Props): void {
  try {
    const u = (globalThis as { umami?: { track?: (e: string, d?: Props) => unknown } }).umami;
    if (u && typeof u.track === 'function') u.track(event, safeProps(data));
  } catch {
    /* analytics never breaks the page */
  }
}
