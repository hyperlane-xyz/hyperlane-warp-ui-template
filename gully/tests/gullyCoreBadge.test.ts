// "Powered by Gully Core" badge (Gully Chain brand kit v4, badges/README.md, owner-approved 2026-10-30) on the bridge's
// mirror routes: the GullyChain-side token is minted on Gully Chain (synthetic), so the swap card shows one line plus the
// compact kit mark, byte for byte (tests/night.test.ts hashes every copy), linked to https://gullychain.xyz/gully-core/
// in a new tab, alt "Powered by Gully Core", never a typed wordmark in its place.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { FAST_ROUTES, GULLY_CORE_URL, isMirrorRoute } from '../src/config/routes';
import routes from '../src/config/routes.json';

const app = resolve(__dirname, '..');
const read = (p: string) => readFileSync(join(app, p), 'utf8');
const sha = (p: string) => createHash('sha256').update(readFileSync(join(app, p))).digest('hex');

// SHA-256 list from GULLY LABS GRAPHICS/Gully Chain/brand-kit-v4/badges/README.md (2026-10-30), dark ground only
const BADGE: Record<string, string> = {
  'gully-core-powered-by-dark.svg': 'b93e952ac9d89c632ddeabd457bfdef2beb2a34751d9a676715ffc45b4a7b43c',
  'gully-core-powered-by-dark.png': '9f0ba1967c13e7c06a8cc09b3cd01afa6ba061141d51c1a0039e8a60b755412e',
  'gully-core-powered-by-dark-2x.png': 'dd79f7c75370be3768291d0fb9caf68a15a193efd5ad685d1a1d506640f24eb7',
  'gully-core-powered-by-dark-3x.png': '40faa6f2d8f6b87c83224d07c7039c2948bc290fbec4f0118a5abcf8a1e0e8ca',
  'gully-core-mark-dark.svg': '02e6842c112586e0f4880f9df917e9b52b455f310cdecd2001fb1e6ae78972f9',
  'gully-core-mark-dark.png': '004c9627d6501fc83ddae5f623e81ef044e02d804515d3849b9395c46842017c',
  'gully-core-mark-dark-2x.png': '53833f5c21492b21c1f9e4338a00f251644c2a7a848ce826961f301387bffbcc',
  'gully-core-mark-dark-3x.png': 'a4d3ef6a0984893c2f3e9b6c49af61180f3d6606685c6613bf6ddc63f6b21219',
};

describe('mirror routes', () => {
  it('routes.json marks the synthetic GullyChain tokens (gETH, hypETH) as mirror routes and the native ETH route not', () => {
    const byId = Object.fromEntries((routes.routes as { id: string; mirror?: boolean; tokens: { gullychaintestnet: { tokenType: string } } }[]).map((r) => [r.id, r]));
    expect(byId['GETH/arbitrumsepolia-gullychaintestnet'].mirror).toBe(true);
    expect(byId['ETH/arbitrumsepolia-gullychaintestnet'].mirror).toBe(true);
    expect(byId['ETH/arbitrumsepolia-gullychaintestnet-native'].mirror).toBeUndefined();
    for (const r of Object.values(byId)) expect(r.mirror ?? false, r.id).toBe(r.tokens.gullychaintestnet.tokenType !== 'native');
  });
  it('isMirrorRoute reads the flag', () => {
    expect(FAST_ROUTES.filter(isMirrorRoute)).toHaveLength(2);
    expect(isMirrorRoute({ mirror: true })).toBe(true);
    expect(isMirrorRoute({})).toBe(false);
    expect(isMirrorRoute(null)).toBe(false);
  });
  it('scripts/sync-routes.mjs writes the flag from the GullyChain token type', () => {
    expect(read('scripts/sync-routes.mjs')).toContain("if (r.tokens.gullychaintestnet.tokenType !== 'native') r.mirror = true;");
  });
});

describe('"Powered by Gully Core" badge (kit v4, byte-identical)', () => {
  for (const [f, want] of Object.entries(BADGE)) {
    it(`public/brand/badges/${f} is the kit file byte for byte`, () => expect(sha(`public/brand/badges/${f}`)).toBe(want));
  }
  it('scripts/brand-from-kit.mjs copies the eight files from gully-ops sites/_shared/brand/kit-v4/badges/gully-core', () => {
    const s = read('scripts/brand-from-kit.mjs');
    for (const f of Object.keys(BADGE)) expect(s, f).toContain(`'${f}'`);
    expect(s).toContain("cp(join(kit, 'badges/gully-core', f), `brand/badges/${f}`)");
  });
  it('links to gullychain.xyz/gully-core/', () => {
    expect(GULLY_CORE_URL).toBe('https://gullychain.xyz/gully-core/');
  });
});

describe('MirrorNotice (swap card, mirror routes only)', () => {
  const parts = read('src/ui/common/parts.tsx');
  const notice = parts.slice(parts.indexOf('export function MirrorNotice('), parts.indexOf('export function QuoteDetails('));
  it('renders only for mirror routes, one line + the compact mark (svg + png srcSet, 146x24, new tab)', () => {
    expect(notice).toContain('if (!b.route?.mirror) return null;');
    expect(notice).toContain('This token is a Gully Core mirror on Gully Chain.');
    expect(notice).toContain('href={GULLY_CORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Powered by Gully Core (opens in a new tab)"');
    expect(notice).toContain('src="brand/badges/gully-core-mark-dark.svg"');
    expect(notice).toContain('srcSet="brand/badges/gully-core-mark-dark.png 1x, brand/badges/gully-core-mark-dark-2x.png 2x, brand/badges/gully-core-mark-dark-3x.png 3x"');
    expect(notice).toContain('width={146}');
    expect(notice).toContain('height={24}');
    expect(notice).toContain('alt="Powered by Gully Core"');
    // relative paths (vite base './'), dark ground only, never a typed wordmark in place of the badge
    expect(notice).not.toMatch(/src="\/brand/);
    expect(parts).not.toMatch(/gully-core-(powered-by|mark)-(light|emerald)/);
    expect(notice).not.toMatch(/>\s*Gully Core\s*</);
  });
  it('is shown in the swap card next to the legacy notice', () => {
    const app = read('src/ui/b/AppB.tsx');
    expect(app).toMatch(/<LegacyNotice b=\{b\} \/>\s*<MirrorNotice b=\{b\} \/>/);
    expect(app).toMatch(/import \{[^}]*MirrorNotice[^}]*\} from '\.\.\/common\/parts'/);
  });
  it('is only scaled, never restyled', () => {
    const css = read('src/styles/base.css');
    expect(css).toContain('.mirror-note .gc-core-mark img { width: 146px; height: 24px; vertical-align: middle; }');
    expect(css).not.toMatch(/\.gc-core-mark[^{]*\{[^}]*(filter|border|background|box-shadow|transform)/);
  });
});
