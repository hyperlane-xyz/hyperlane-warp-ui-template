// @vitest-environment happy-dom
// Gully Chain sync (2026-10-30): the bridge's "Connect a wallet" is the shared gc-connect dialog (Gully Wallet first,
// WalletConnect, EIP-6963 wallets, then install links), a byte copy of gully-ops sites/_shared/gc-connect; the switcher
// is gc-switcher 1.8.2. The kit v3 guard fails on v3 colours, fonts, art files, typed wordmarks and kre8.fun chrome links.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { disconnect, openConnect, walletFromResult, walletStore, type ConnectResult } from './wallet';

const app = resolve(__dirname, '..', '..');
const sha = (p: string) => createHash('sha256').update(readFileSync(join(app, p))).digest('hex');
const GC_CONNECT_SHA = '29c387340d0151ad2c2a01277853090b2d1442907b631146169ebd6a9bba2c2e'; // gully-ops gc-connect 1.1.0 (9fa17a9b)

function fakeProvider(chainId = '0x768d6') {
  return { request: vi.fn(async ({ method }: { method: string }) => (method === 'eth_chainId' ? chainId : [])), on: vi.fn() };
}
const result = (over: Partial<ConnectResult> = {}): ConnectResult => ({
  kind: 'gully', id: 'gully', name: 'Gully Wallet', icon: null, rdns: 'xyz.gullyid.wallet',
  provider: fakeProvider() as never, accounts: ['0x00000000000000000000000000000000000000a1'], ...over,
});

afterEach(() => disconnect());

describe('shared Connect a wallet dialog (gc-connect)', () => {
  it('is the byte copy of gully-ops gc-connect 1.1.0 and is bundled by the wallet UI', () => {
    expect(sha('src/gc-connect/gc-connect.js')).toBe(GC_CONNECT_SHA);
    const parts = readFileSync(join(app, 'src/ui/common/parts.tsx'), 'utf8');
    expect(parts).toContain("import '../../gc-connect/gc-connect.js'");
    expect(parts).not.toMatch(/function WalletModal/);
  });
  it('the dialog lists Gully Wallet, then WalletConnect, then detected wallets, then install links', async () => {
    await import('../gc-connect/gc-connect.js');
    const gc = (window as unknown as { GullyConnect: { VERSION: string; INSTALL: { rdns: string }[] } }).GullyConnect;
    expect(gc.VERSION).toBe('1.1.0');
    expect(gc.INSTALL.map((x) => x.rdns)).toEqual(['io.metamask', 'io.rabby', 'com.coinbase.wallet']);
    const src = readFileSync(join(app, 'src/gc-connect/gc-connect.js'), 'utf8');
    const r = src.slice(src.indexOf('this.render = function'));
    expect(r.indexOf("row('gully'")).toBeLessThan(r.indexOf("row('walletconnect'"));
    // owner: the first row reads "Sign in with Gully ID" and carries data-gcc="gully-id" (the deploy post-check clicks it)
    expect(r.slice(r.indexOf("row('gully'"), r.indexOf("row('walletconnect'"))).toContain("'Sign in with Gully ID'");
    expect(r.slice(r.indexOf("row('gully'"), r.indexOf("row('walletconnect'"))).toContain("gcc: 'gully-id'");
    expect(r.indexOf("row('walletconnect'")).toBeLessThan(r.indexOf('Detected in this browser'));
    expect(r.indexOf('Detected in this browser')).toBeLessThan(r.indexOf('Get a wallet'));
  });
  it('maps a dialog result onto the bridge wallet (Gully Wallet by rdns, 6963 by rdns, WalletConnect)', () => {
    expect(walletFromResult(result()).rdns).toBe('xyz.gullyid.wallet');
    expect(walletFromResult(result({ kind: 'injected', id: 'io.rabby', name: 'Rabby', rdns: 'io.rabby' })).rdns).toBe('io.rabby');
    expect(walletFromResult(result({ kind: 'walletconnect', id: 'walletconnect', name: 'WalletConnect', rdns: null })).rdns).toBe('walletconnect');
  });
  it('openConnect attaches the picked wallet and its chain', async () => {
    const open = vi.fn(async () => result());
    await expect(openConnect({ VERSION: '1.0.0', open })).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ appName: 'Gully Bridge' }));
    const s = walletStore.get();
    expect(s.address).toBe('0x00000000000000000000000000000000000000a1');
    expect(s.active?.name).toBe('Gully Wallet');
    expect(s.chainId).toBe(485590);
    expect(s.connecting).toBe(false);
  });
  it('closing the dialog (4001) is not an error', async () => {
    const open = vi.fn(async () => { throw Object.assign(new Error('closed'), { code: 4001 }); });
    await expect(openConnect({ VERSION: '1.0.0', open })).resolves.toBe(false);
    expect(walletStore.get().error).toBeUndefined();
    expect(walletStore.get().address).toBeUndefined();
  });
  it('a missing dialog script surfaces an error instead of failing silently', async () => {
    const w = window as unknown as { GullyConnect?: unknown };
    const saved = w.GullyConnect;
    delete w.GullyConnect; // the page without the dialog script (openConnect falls back to window.GullyConnect)
    try {
      await expect(openConnect()).rejects.toThrow(/GullyConnect/);
      expect(walletStore.get().error).toMatch(/did not load/);
    } finally {
      w.GullyConnect = saved;
    }
  });
});

// ---- kit v4 guard: fails on kit v3 leftovers, typed wordmarks and kre8.fun navigation ----
const V3 = [/#00B2FA/i, /#46FB04/i, /#2563FF/i, /#05080D/i, /#0A1018/i, /#01D9FA/i, /#1567F9/i, /Exo 2|Exo\+2|exo2-/, /gullychain-wordmark/, /gullychain-logo-(transparent|original)/, /gullychain-mascot/, /gullychain-powered-by|gullychain-secured-by/];
function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(join(app, dir))) {
    const rel = `${dir}/${f}`;
    if (statSync(join(app, rel)).isDirectory()) files(rel, out);
    else if (/\.(tsx?|css|html|svg|json|webmanifest)$/.test(f) && !/\.test\.tsx?$/.test(f)) out.push(rel);
  }
  return out;
}
describe('kit v4 only (no kit v3 left)', () => {
  const list = [...files('src'), ...files('public'), 'index.html'].filter((f) => !f.startsWith('src/gc-switcher/') && !f.startsWith('src/gc-connect/'));
  it('scans the app sources and public files', () => expect(list.length).toBeGreaterThan(30));
  it('no kit v3 colour, font or art reference', () => {
    const bad: string[] = [];
    for (const f of list) { const t = readFileSync(join(app, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''); for (const re of V3) if (re.test(t)) bad.push(`${f} ${re}`); }
    expect(bad).toEqual([]);
  });
  it('no kit v3 art files shipped', () => {
    const shipped = files('public').filter((f) => /gullychain-(wordmark|logo|mascot|lockup|powered-by|secured-by)|exo2/.test(f));
    expect(shipped).toEqual([]);
  });
  it('no typed GullyChain wordmark and no kre8.fun / "Launch app" in the shell', () => {
    for (const f of ['src/ui/common/shell.tsx', 'src/ui/common/parts.tsx', 'index.html']) {
      const t = readFileSync(join(app, f), 'utf8');
      expect(t, f).not.toMatch(/>\s*Gully ?Chain\s*<\/(a|span|b|strong)>/);
      expect(t, f).not.toMatch(/kre8\.fun|Launch app/);
    }
  });
});

// ---- every EVM connect entry point opens the shared dialog, never RainbowKit or a raw injected prompt ----
describe('EVM connect entry points', () => {
  it('the live bridge app (gully/) has no RainbowKit at all', () => {
    const pkg = readFileSync(join(app, 'package.json'), 'utf8');
    expect(pkg).not.toMatch(/rainbow-me|rainbowkit|wagmi/);
    const bad = files('src').filter((f) => /\.tsx?$/.test(f) && /rainbowkit|openConnectModal|ConnectButton|useConnectModal/.test(readFileSync(join(app, f), 'utf8')));
    expect(bad).toEqual([]);
  });
  it('only wallet.ts asks a provider for accounts, and every Connect button calls pickWallet', () => {
    const asks = files('src').filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f) && /eth_requestAccounts/.test(readFileSync(join(app, f), 'utf8')));
    expect(asks).toEqual(['src/bridge/wallet.ts']);
    const parts = readFileSync(join(app, 'src/ui/common/parts.tsx'), 'utf8');
    const connects = [...parts.matchAll(/<Btn[^>]*>\s*Connect( wallet)?\s*<\/Btn>/g)].map((m) => m[0]);
    expect(connects.length).toBe(2);
    for (const c of connects) expect(c).toContain('onClick={pickWallet}');
  });
  it('clicking Connect opens GullyConnect (row 1 "Sign in with Gully ID")', async () => {
    const { createElement } = await import('react');
    const { act } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { WalletButton } = await import('../ui/common/parts');
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const w = window as unknown as { GullyConnect?: unknown };
    const saved = w.GullyConnect;
    const open = vi.fn(async () => { throw Object.assign(new Error('closed'), { code: 4001 }); });
    w.GullyConnect = { VERSION: '1.1.0', open };
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    try {
      await act(async () => root.render(createElement(WalletButton, { compact: true })));
      const btn = [...host.querySelectorAll('button')].find((b) => /Connect/.test(b.textContent || ''));
      expect(btn).toBeTruthy();
      await act(async () => { btn!.click(); });
      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith(expect.objectContaining({ appName: 'Gully Bridge' }));
    } finally {
      await act(async () => root.unmount());
      host.remove();
      w.GullyConnect = saved;
    }
  });
});
