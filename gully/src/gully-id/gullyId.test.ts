import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CLIENT_ID,
  DEFAULT_ISSUER,
  getGullyClient,
  gullyIdConfig,
  loadGullyIdSdk,
  markGullyId,
  profileWallet,
  resetGullyIdLoader,
  type GullyClient,
  type GullyIDGlobal,
  type GullyProfile,
} from './gullyId';

type FakeScript = { src: string; async: boolean; crossOrigin: string; onload?: () => void; onerror?: () => void };

function fakeEnv(sdk?: GullyIDGlobal, outcome: 'load' | 'error' | 'hang' | 'v1-missing' = 'load') {
  const win: { GullyID?: GullyIDGlobal } = {};
  const scripts: FakeScript[] = [];
  const doc = {
    createElement: () => ({ src: '', async: false, crossOrigin: '' }) as FakeScript,
    head: {
      appendChild: (s: FakeScript) => {
        scripts.push(s);
        queueMicrotask(() => {
          if (outcome === 'v1-missing') {
            if (s.src.endsWith('/sdk/v1.js')) return s.onerror?.();
            if (sdk) win.GullyID = sdk;
            return s.onload?.();
          }
          if (outcome === 'error') s.onerror?.();
          if (outcome === 'load') {
            if (sdk) win.GullyID = sdk;
            s.onload?.();
          }
        });
        return s;
      },
    },
  } as unknown as Pick<Document, 'createElement' | 'head'>;
  return { env: { win, doc, timeoutMs: 50 }, scripts };
}

function fakeClient(): GullyClient {
  return {
    handleRedirect: vi.fn(async () => null),
    session: () => null,
    signOut: async () => {},
    onChange: () => () => {},
    renderButton: () => () => {},
  };
}

afterEach(() => resetGullyIdLoader());

describe('gullyIdConfig (feature flag)', () => {
  it('is on by default with the gully-bridge client on gullyid.xyz', () => {
    expect(DEFAULT_CLIENT_ID).toBe('gully-bridge');
    expect(gullyIdConfig({})).toEqual({ clientId: 'gully-bridge', issuer: 'https://gullyid.xyz' });
    expect(gullyIdConfig({ VITE_GULLY_ID_CLIENT_ID: '  ' })).toEqual({ clientId: 'gully-bridge', issuer: DEFAULT_ISSUER });
    expect(gullyIdConfig({ VITE_GULLY_ID_SIGNIN: 'on' })).not.toBeNull();
  });
  it('VITE_GULLY_ID_SIGNIN=off hides it', () => {
    for (const v of ['off', 'OFF', 'false', '0', 'no']) expect(gullyIdConfig({ VITE_GULLY_ID_SIGNIN: v })).toBeNull();
  });
  it('publishes the flag on <html>', () => {
    const doc = { documentElement: { dataset: {} as DOMStringMap } } as unknown as Pick<Document, 'documentElement'>;
    markGullyId({ clientId: 'gully-bridge', issuer: DEFAULT_ISSUER }, doc);
    expect(doc.documentElement.dataset).toEqual({ gullyId: 'on', gullyIdClient: 'gully-bridge' });
    markGullyId(null, doc);
    expect(doc.documentElement.dataset.gullyId).toBe('off');
  });
  it('uses the default issuer', () => {
    expect(gullyIdConfig({ VITE_GULLY_ID_CLIENT_ID: 'gully-bridge' })).toEqual({ clientId: 'gully-bridge', issuer: DEFAULT_ISSUER });
  });
  it('accepts an https issuer override and ignores a bad one', () => {
    expect(gullyIdConfig({ VITE_GULLY_ID_CLIENT_ID: 'x', VITE_GULLY_ID_ISSUER: 'https://id.example.xyz/' })?.issuer).toBe('https://id.example.xyz');
    expect(gullyIdConfig({ VITE_GULLY_ID_CLIENT_ID: 'x', VITE_GULLY_ID_ISSUER: 'http://evil.example' })?.issuer).toBe(DEFAULT_ISSUER);
    expect(gullyIdConfig({ VITE_GULLY_ID_CLIENT_ID: 'x', VITE_GULLY_ID_ISSUER: 'not a url' })?.issuer).toBe(DEFAULT_ISSUER);
  });
});

describe('loadGullyIdSdk (fail soft)', () => {
  it('falls back to /sdk.js while /sdk/v1.js is not live', async () => {
    const sdk = { init: () => fakeClient() };
    const { env, scripts } = fakeEnv(sdk, 'v1-missing');
    expect(await loadGullyIdSdk(DEFAULT_ISSUER, env)).toBe(sdk);
    expect(scripts.map((s) => s.src)).toEqual(['https://gullyid.xyz/sdk/v1.js', 'https://gullyid.xyz/sdk.js']);
  });
  it('loads the 1.x SDK from the issuer once', async () => {
    const sdk = { init: () => fakeClient() };
    const { env, scripts } = fakeEnv(sdk);
    const [a, b] = await Promise.all([loadGullyIdSdk(DEFAULT_ISSUER, env), loadGullyIdSdk(DEFAULT_ISSUER, env)]);
    expect(a).toBe(sdk);
    expect(b).toBe(sdk);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe('https://gullyid.xyz/sdk/v1.js');
  });
  it('resolves null when the script errors', async () => {
    expect(await loadGullyIdSdk(DEFAULT_ISSUER, fakeEnv(undefined, 'error').env)).toBeNull();
  });
  it('resolves null when the script loads without GullyID', async () => {
    expect(await loadGullyIdSdk(DEFAULT_ISSUER, fakeEnv(undefined, 'load').env)).toBeNull();
  });
  it('resolves null on timeout', async () => {
    expect(await loadGullyIdSdk(DEFAULT_ISSUER, fakeEnv(undefined, 'hang').env)).toBeNull();
  });
});

describe('getGullyClient', () => {
  it('inits with the client id and finishes a redirect', async () => {
    const c = fakeClient();
    const init = vi.fn(() => c);
    const got = await getGullyClient({ clientId: 'gully-bridge', issuer: DEFAULT_ISSUER }, fakeEnv({ init }).env);
    expect(got).toBe(c);
    expect(init).toHaveBeenCalledWith({ clientId: 'gully-bridge', issuer: DEFAULT_ISSUER });
    expect(c.handleRedirect).toHaveBeenCalledOnce();
  });
  it('is null when init throws', async () => {
    const init = () => {
      throw new Error('boom');
    };
    expect(await getGullyClient({ clientId: 'x', issuer: DEFAULT_ISSUER }, fakeEnv({ init }).env)).toBeNull();
  });
});

describe('profileWallet', () => {
  const base: GullyProfile = { sub: 's', name: 'frog.gully', gullyName: 'frog.gully', avatar: null, wallet: null, wallets: [], amr: ['passkey'] };
  it('prefers the main wallet, then the first linked one, else none', () => {
    const main = { chainId: 485590, address: '0x' + '1'.repeat(40), kind: 'kernel-v3.3' as const };
    const eoa = { chainId: null, address: '0x' + '2'.repeat(40), kind: 'eoa' as const };
    expect(profileWallet({ ...base, wallet: main, wallets: [eoa] })).toBe(main);
    expect(profileWallet({ ...base, wallets: [eoa] })).toBe(eoa);
    expect(profileWallet(base)).toBeNull();
    expect(profileWallet(null)).toBeNull();
  });
});
