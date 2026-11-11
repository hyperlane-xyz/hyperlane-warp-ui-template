// Sign in with Gully ID: config, types and the lazy SDK loader.
// Contract: gully-id docs/gully-id-current-spec (SDK https://gullyid.xyz/sdk/v1.js, legacy /sdk.js, window.GullyID).
// On by default (owner rule 2026-10-30); VITE_GULLY_ID_SIGNIN=off hides the button (rollback).
//
// Identity only. Nothing here touches the bridge wallet: transfers are still signed by the wallet the user
// connects with the Connect button, and a signed-in profile never auto-connects anything.

export type GullyWallet = { chainId: number | null; address: string; kind: 'kernel-v3.3' | 'eoa' };

export interface GullyProfile {
  sub: string;
  name: string;
  gullyName: string | null;
  avatar: string | null;
  wallet: (GullyWallet & { chainId: number }) | null;
  wallets: GullyWallet[];
  amr: string[];
  verified?: boolean;
}

export interface GullySession {
  via: 'oidc' | 'passkey';
  accessToken: string;
  idToken: string | null;
  expiresAt: number;
  user: GullyProfile;
}

export interface GullyClient {
  handleRedirect(): Promise<GullySession | null>;
  session(): GullySession | null;
  signOut(): Promise<void>;
  onChange(cb: (s: GullySession | null) => void): () => void;
  renderButton(
    el: HTMLElement,
    o?: {
      onSignIn?: (s: GullySession) => void;
      onError?: (e: unknown) => void;
      label?: string;
      passkey?: boolean;
      theme?: 'dark' | 'light';
      size?: 's' | 'm' | 'l';
    },
  ): () => void;
}

export interface GullyIDGlobal {
  init(opts: { clientId: string; issuer?: string; scope?: string; redirectUri?: string }): GullyClient;
}

export type GullyIdConfig = { clientId: string; issuer: string };

export const DEFAULT_ISSUER = 'https://gullyid.xyz';
export const DEFAULT_CLIENT_ID = 'gully-bridge';

/** Feature flag, default on: VITE_GULLY_ID_SIGNIN=off (false/0/no) = no button and the SDK is never loaded. */
export function gullyIdConfig(env: Record<string, unknown>): GullyIdConfig | null {
  const flag = typeof env.VITE_GULLY_ID_SIGNIN === 'string' ? env.VITE_GULLY_ID_SIGNIN.trim() : '';
  if (/^(off|false|0|no)$/i.test(flag)) return null;
  const id = typeof env.VITE_GULLY_ID_CLIENT_ID === 'string' ? env.VITE_GULLY_ID_CLIENT_ID.trim() : '';
  const clientId = id || DEFAULT_CLIENT_ID;
  const raw = typeof env.VITE_GULLY_ID_ISSUER === 'string' ? env.VITE_GULLY_ID_ISSUER.trim() : '';
  let issuer = DEFAULT_ISSUER;
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1') issuer = u.origin;
    } catch {
      /* keep the default */
    }
  }
  return { clientId, issuer };
}

/** Publishes the flag on <html data-gully-id="on|off" data-gully-id-client> so the live audit can read it. */
export function markGullyId(cfg: GullyIdConfig | null, doc: Pick<Document, 'documentElement'> | undefined = typeof document === 'undefined' ? undefined : document) {
  if (!doc) return;
  const d = doc.documentElement.dataset;
  d.gullyId = cfg ? 'on' : 'off';
  if (cfg) d.gullyIdClient = cfg.clientId;
}

/** SDK URLs, best first: the 1.x channel, then the legacy all-majors URL (while /sdk/v1.js is not live yet). */
export const sdkUrls = (issuer: string) => [`${issuer}/sdk/v1.js`, `${issuer}/sdk.js`];

type LoaderEnv = {
  win: { GullyID?: GullyIDGlobal };
  doc: Pick<Document, 'createElement' | 'head'>;
  timeoutMs?: number;
};

let pending: Promise<GullyIDGlobal | null> | null = null;

/**
 * Loads `${issuer}/sdk/v1.js` (falling back to `${issuer}/sdk.js`) once and resolves with window.GullyID, or with null when the script fails, times out
 * or does not expose GullyID. Never rejects: a missing SDK just means no sign-in button.
 */
export function loadGullyIdSdk(issuer: string, env?: LoaderEnv): Promise<GullyIDGlobal | null> {
  if (pending) return pending;
  const win = env?.win ?? (window as unknown as { GullyID?: GullyIDGlobal });
  const doc = env?.doc ?? document;
  const timeoutMs = env?.timeoutMs ?? 10_000;
  const valid = (g: unknown): g is GullyIDGlobal => !!g && typeof (g as GullyIDGlobal).init === 'function';
  if (valid(win.GullyID)) return (pending = Promise.resolve(win.GullyID));
  pending = new Promise<GullyIDGlobal | null>((resolve) => {
    let done = false;
    const finish = (g: GullyIDGlobal | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!g) pending = null; // allow a later retry (next page load in practice)
      resolve(g);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const tryUrl = (urls: string[]) => {
      if (!urls.length) return finish(null);
      try {
        const s = doc.createElement('script');
        s.src = urls[0];
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onload = () => (valid(win.GullyID) ? finish(win.GullyID) : tryUrl(urls.slice(1)));
        s.onerror = () => tryUrl(urls.slice(1));
        doc.head.appendChild(s);
      } catch {
        finish(null);
      }
    };
    tryUrl(sdkUrls(issuer));
  });
  return pending;
}

/** Test hook. */
export function resetGullyIdLoader() {
  pending = null;
  client = null;
}

let client: Promise<GullyClient | null> | null = null;

/** One client per page (React StrictMode mounts twice). Finishes a redirect-mode sign-in if the URL carries one. */
export function getGullyClient(cfg: GullyIdConfig, env?: LoaderEnv): Promise<GullyClient | null> {
  if (client) return client;
  client = loadGullyIdSdk(cfg.issuer, env).then(async (sdk) => {
    if (!sdk) {
      client = null;
      return null;
    }
    try {
      const c = sdk.init({ clientId: cfg.clientId, issuer: cfg.issuer });
      try {
        await c.handleRedirect();
      } catch (e) {
        console.warn('[gully-id] redirect sign-in failed', e);
      }
      return c;
    } catch (e) {
      console.warn('[gully-id] init failed', e);
      client = null;
      return null;
    }
  });
  return client;
}

/** The profile's main wallet, or its first one: shown next to the button, never connected. */
export function profileWallet(p: GullyProfile | null | undefined): GullyWallet | null {
  if (!p) return null;
  return p.wallet ?? p.wallets?.[0] ?? null;
}

export function walletKindLabel(kind: GullyWallet['kind']) {
  return kind === 'kernel-v3.3' ? 'Smart account' : 'Wallet';
}
