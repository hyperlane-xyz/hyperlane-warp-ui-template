// Gully Chain Night: the vendored shared design files must be byte-identical to gully-ops at the locked commit
// (night.lock.json, written by scripts/sync-gullychain-night.mjs), and the logos/badges on the black pages must be the
// brand-kit dark-ground files, byte for byte (SHA-256 of the kit files).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = resolve(__dirname, '..');
const sha = (p: string) => createHash('sha256').update(readFileSync(join(app, p))).digest('hex');
const lock = JSON.parse(readFileSync(join(app, 'src/styles/night/night.lock.json'), 'utf8')) as {
  commit: string;
  files: Record<string, { source: string; sha256: string }>;
};

// GullyChain brand kit v4 (gully-ops sites/_shared/brand/kit-v4 = GULLY LABS GRAPHICS/Gully Chain/brand-kit-v4), the GN 2.0
// favicons + bridge OG card (gully-ops sites/_shared/landing, brand/og), and the Gully Labs kit dark badges
const KIT: Record<string, string> = {
  'public/brand/logo/gc-icon.svg': '4f86d2a0c2bb1afda317f21ae7c2198564ca61241f2c48cc75df1cb87033739b',
  'public/brand/badges/badge-dark.png': '8ca009ecda8e77d99376532634d06e67815b971119edb3f4f97f4467aa7863e9',
  'public/favicon.svg': '4f86d2a0c2bb1afda317f21ae7c2198564ca61241f2c48cc75df1cb87033739b',
  'public/favicon-16.png': 'be9b219a27d30b1be8e105315b3646bb239257cd874d6601dc85842bee7fd915',
  'public/favicon-32.png': 'ed62db32d009966ca42b5fbd040f8a44850a48b0961030e11373ca9afb7b4647',
  'public/apple-touch-icon.png': '75186c345bd0dfcad8c3396b45e647029afb2fc39d5c2b47ac2d4475cb30e239',
  'public/android-chrome-192.png': '124e2bda6af687339242b20a0153587400c184033fb242528626bacb3451f1e1',
  'public/android-chrome-512.png': '129e80e570c1a00ab6f49bfbeea63ad7d14dff0d6941bb32f1e6d02f7f49de56',
  'public/og-image.png': '507fef5e1112d90010e342b3067516c790b1ca222bce194d40c4045345543d8a',
  'public/brand/badges/gully-labs-powered-by-dark.svg': '25b50f55dea2a2fc1573af73b12daf84c490af07c2f7c4e7bf51d9abe21dd862',
  // "Powered by Gully Core" (kit v4 badges/gully-core, README.md SHA-256 list 2026-10-30), dark ground only
  'public/brand/badges/gully-core-powered-by-dark.svg': 'b93e952ac9d89c632ddeabd457bfdef2beb2a34751d9a676715ffc45b4a7b43c',
  'public/brand/badges/gully-core-powered-by-dark.png': '9f0ba1967c13e7c06a8cc09b3cd01afa6ba061141d51c1a0039e8a60b755412e',
  'public/brand/badges/gully-core-powered-by-dark-2x.png': 'dd79f7c75370be3768291d0fb9caf68a15a193efd5ad685d1a1d506640f24eb7',
  'public/brand/badges/gully-core-powered-by-dark-3x.png': '40faa6f2d8f6b87c83224d07c7039c2948bc290fbec4f0118a5abcf8a1e0e8ca',
  'public/brand/badges/gully-core-mark-dark.svg': '02e6842c112586e0f4880f9df917e9b52b455f310cdecd2001fb1e6ae78972f9',
  'public/brand/badges/gully-core-mark-dark.png': '004c9627d6501fc83ddae5f623e81ef044e02d804515d3849b9395c46842017c',
  'public/brand/badges/gully-core-mark-dark-2x.png': '53833f5c21492b21c1f9e4338a00f251644c2a7a848ce826961f301387bffbcc',
  'public/brand/badges/gully-core-mark-dark-3x.png': 'a4d3ef6a0984893c2f3e9b6c49af61180f3d6606685c6613bf6ddc63f6b21219',
};

describe('Gully Chain Night (shared tokens)', () => {
  it('is locked to a gully-ops commit', () => {
    expect(lock.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(Object.keys(lock.files)).toHaveLength(5);
    expect(Object.keys(lock.files)).toContain('public/assets/fonts/inter-var.woff2');
  });
  for (const [file, { sha256 }] of Object.entries(lock.files)) {
    it(`${file} is byte-identical to gully-ops`, () => expect(sha(file)).toBe(sha256));
  }
  it('the app loads the shared tokens first and has no Studio Light left', () => {
    const main = readFileSync(join(app, 'src/main.tsx'), 'utf8');
    expect(main.indexOf("'./styles/night/tokens.css'")).toBeGreaterThan(-1);
    expect(main.indexOf("'./styles/night/tokens.css'")).toBeLessThan(main.indexOf("'./styles/base.css'"));
    expect(main).not.toMatch(/studio-light/);
    expect(existsSync(join(app, 'src/styles/studio-light.css'))).toBe(false);
  });
  it('the night stylesheets use tokens, not colour literals (masks excepted)', () => {
    for (const f of ['night.css', 'base.css', 'c.css']) {
      const css = readFileSync(join(app, 'src/styles', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const hex = (css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter((h) => h !== '#000');
      expect(hex, f).toEqual([]);
    }
  });
});

describe('brand kit files on the black pages', () => {
  for (const [file, want] of Object.entries(KIT)) {
    it(`${file} is the kit file byte for byte`, () => expect(sha(file)).toBe(want));
  }
  it('no light-ground logo or badge is referenced', () => {
    for (const f of ['src/ui/common/parts.tsx', 'src/ui/common/shell.tsx', 'index.html']) {
      expect(readFileSync(join(app, f), 'utf8'), f).not.toMatch(/for-light-bg|-light\.(svg|png)|-light-[23]x/);
    }
  });
  it('kit v4 only: icon + dark badge, no kit v3 logo, wordmark, badge or font', () => {
    for (const f of ['src/ui/common/parts.tsx', 'src/ui/common/shell.tsx', 'index.html']) {
      const s = readFileSync(join(app, f), 'utf8');
      expect(s, f).not.toMatch(/gullychain-logo|wordmark-for|gullychain-powered-by|mascot-trader|exo2/);
    }
    expect(readFileSync(join(app, 'src/ui/common/shell.tsx'), 'utf8')).toContain('src="brand/logo/gc-icon.svg" width={32} height={32}');
    const parts = readFileSync(join(app, 'src/ui/common/parts.tsx'), 'utf8');
    expect(parts).toContain('src="brand/badges/badge-dark.png" width={180} height={48}');
    for (const f of ['night.css', 'base.css', 'a.css', 'b.css', 'c.css']) {
      const css = readFileSync(join(app, 'src/styles', f), 'utf8');
      expect(css, f).not.toMatch(/Exo 2|#05080D|#0A1018|#2563FF|#00B2FA|#46FB04|#F2F5F7|#8A97A8|0,\s*178,\s*250/i);
    }
  });
  it('Inter preload, absolute OG card, dark theme-color and the dark product switcher', () => {
    const html = readFileSync(join(app, 'index.html'), 'utf8');
    expect(html).toContain('<link rel="preload" href="/assets/fonts/inter-var.woff2"');
    expect(html).toContain('<meta property="og:image" content="%SITE_URL%og-image.png" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(readFileSync(join(app, 'scripts/build-staging.mjs'), 'utf8')).toContain("VITE_SITE_URL: 'https://testnet-bridge.gullychain.xyz/'");
    expect(html).toMatch(/name="theme-color" content="#0A0F0E"/);
    expect(readFileSync(join(app, 'public/site.webmanifest'), 'utf8')).toContain('"theme_color": "#0A0F0E"');
    expect(readFileSync(join(app, 'src/ui/common/shell.tsx'), 'utf8')).toMatch(/theme="dark"/);
  });
});

// Design-gap audit 2026-10-29: one click from the bridge to every key Gully Chain surface.
describe('navigation reach (gc-switcher 1.8.3 + footer)', () => {
  it('ships gc-switcher 1.8.3 (Gully Chain products only, no kre8.fun; kit v4 icon; Ecosystem entry) in the dark header', () => {
    const js = readFileSync(join(app, 'src/gc-switcher/gc-switcher.js'), 'utf8');
    expect(js).toMatch(/GC_SWITCHER_VERSION = '1\.8\.3'/);
    expect(js.slice(js.indexOf('var PRODUCTS = ['), js.indexOf('];', js.indexOf('var PRODUCTS = [')))).not.toMatch(/kre8\.fun/);
    expect(js).toMatch(/id: 'ecosystem'[^}]*https:\/\/gullychain\.xyz\/ecosystem\//);
    expect(js).toMatch(/showPopover\(\)/);
    const shell = readFileSync(join(app, 'src/ui/common/shell.tsx'), 'utf8');
    expect(shell).toMatch(/<GullyChainSwitcher current="bridge" theme="dark"/);
  });
  it('footer links the dev portal, the chain ecosystem page and status', () => {
    const parts = readFileSync(join(app, 'src/ui/common/parts.tsx'), 'utf8');
    const foot = parts.slice(parts.indexOf('export const FOOT_LINKS'), parts.indexOf('export function Footer'));
    for (const k of ['LINKS.dev', 'LINKS.chainEcosystem', 'LINKS.status', 'LINKS.explorer', 'LINKS.faucet', 'LINKS.docs']) expect(foot).toContain(`href: ${k} }`);
    const chains = readFileSync(join(app, 'src/config/chains.ts'), 'utf8');
    expect(chains).toContain("dev: 'https://dev.gullychain.xyz/'");
    expect(chains).toContain("chainEcosystem: 'https://gullychain.xyz/ecosystem/'");
  });
});
