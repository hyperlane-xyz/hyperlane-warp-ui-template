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
  'public/brand/badges/powered-by-gully-labs-dark.svg': '9dbacd2deedf4ea0606a9697cd74f627589a1456d7fea9b600bd81461b57c41b',
  'public/brand/badges/powered-by-gully-labs-dark.png': '49f4b242ca6fb6016f47981a82f4858534a0485375b83cf9e0bedbd86ec73134',
  'public/brand/badges/powered-by-gully-labs-dark-2x.png': '15cee9a5612d6065ddf0feea5f5373e86dca68dbf1376b72364f6b201c8672dd',
  'public/brand/badges/powered-by-gully-labs-dark-3x.png': '78861a7b54bf7a35c1baab3328c7000aad901f9b1fa1b213f8409255e41082ce',
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
describe('navigation reach (gc-switcher 1.8.2 + footer)', () => {
  it('ships gc-switcher 1.8.2 (Gully Chain products only, no kre8.fun; kit v4 icon; Ecosystem entry) in the dark header', () => {
    const js = readFileSync(join(app, 'src/gc-switcher/gc-switcher.js'), 'utf8');
    expect(js).toMatch(/GC_SWITCHER_VERSION = '1\.8\.2'/);
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
