// Gully Chain has one Terms of Service and one Privacy Policy, on gullychain.xyz; they cover the bridge. Every footer
// (the embed's minimal one too) links them in a new tab, the transfer button carries a one-line consent, and /terms +
// /privacy on this host redirect there (Caddy serves index.html for every path, so the app does it).
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/gc-switcher/GullyChainSwitcher', () => ({ GullyChainSwitcher: () => null }));

const app = resolve(__dirname, '..');
const read = (p: string) => readFileSync(join(app, p), 'utf8');
const SLOW = 120_000;
const TERMS = 'https://gullychain.xyz/terms';
const PRIVACY = 'https://gullychain.xyz/privacy';
const newTab = (u: string) => new RegExp(`<a href="${u.replace(/[./]/g, '\\$&')}" target="_blank" rel="noopener noreferrer">`);

describe('Gully Chain Terms and Privacy on the bridge', () => {
  it('/terms and /privacy (with or without a slash) redirect to gullychain.xyz; other paths do not', async () => {
    const { legalRedirect } = await import('../src/config/legal');
    expect(legalRedirect('/terms')).toBe(TERMS);
    expect(legalRedirect('/terms/')).toBe(TERMS);
    expect(legalRedirect('/privacy')).toBe(PRIVACY);
    expect(legalRedirect('/privacy/')).toBe(PRIVACY);
    for (const p of ['/', '/embed', '/terms-x', '/legal/terms']) expect(legalRedirect(p)).toBeNull();
  });

  it('main.tsx replaces the location before the bridge renders', () => {
    const main = read('src/main.tsx');
    expect(main).toContain('const legalTo = legalRedirect(location.pathname);');
    expect(main).toMatch(/if \(legalTo\) \{[\s\S]*?location\.replace\(legalTo\);/);
    expect(main.indexOf('location.replace(legalTo)')).toBeLessThan(main.indexOf('createRoot('));
  });

  for (const minimal of [false, true]) {
    it(`the ${minimal ? 'minimal (embed) ' : ''}footer links both pages in a new tab`, async () => {
      const { Footer } = await import('../src/ui/common/parts');
      const html = renderToStaticMarkup(createElement(Footer, { minimal }));
      const nav = html.slice(html.indexOf('<nav class="foot-legal" aria-label="Legal">'));
      expect(nav.length).toBeLessThan(html.length);
      expect(nav).toMatch(newTab(TERMS));
      expect(nav).toMatch(newTab(PRIVACY));
      expect(nav).toMatch(/<svg\b[\s\S]*?Terms<\/a>/);
    }, SLOW);
  }

  it('the consent line under the transfer button links both pages in a new tab', async () => {
    const { ConsentLine } = await import('../src/ui/common/parts');
    const html = renderToStaticMarkup(createElement(ConsentLine));
    expect(html.replace(/<[^>]+>/g, '')).toBe('By bridging you agree to the Gully Chain Terms and Privacy Policy.');
    expect(html).toMatch(newTab(TERMS));
    expect(html).toMatch(newTab(PRIVACY));
    const parts = read('src/ui/common/parts.tsx');
    const btn = parts.slice(parts.indexOf('export function ActionButton'), parts.indexOf('export function ActivityList'));
    expect(btn.match(/<ConsentLine \/>/g)).toHaveLength(2); // under Connect wallet and under the send button
  }, SLOW);

  it('no draft legal marker and no old docs.gullychain.xyz/privacy link in the app sources', () => {
    const files = ['index.html', 'picker/index.html', ...readdirSync(join(app, 'src'), { recursive: true }).map((f) => `src/${f}`)];
    for (const f of files.filter((f) => /\.(tsx?|html|css)$/.test(f))) {
      const t = read(f.replace(/\\/g, '/'));
      expect(t, f).not.toMatch(/pending legal review|review by counsel/i);
      expect(t, f).not.toContain('docs.gullychain.xyz/privacy');
    }
  });
});
