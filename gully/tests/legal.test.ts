// Terms and Privacy for the bridge: /terms and /privacy render the draft pages (marked "Draft – pending legal review"),
// every footer (also the embed's minimal one) links them, and the mainnet build drops the faucet and testnet copy.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/gc-switcher/GullyChainSwitcher', () => ({ GullyChainSwitcher: () => null }));

const SLOW = 120_000;
const app = resolve(__dirname, '..');
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('bridge legal pages', () => {
  it('maps /terms and /privacy (and only those) to the legal pages', async () => {
    const { legalKindOf } = await import('../src/ui/legal/LegalPage');
    expect(legalKindOf('/terms')).toBe('terms');
    expect(legalKindOf('/terms/')).toBe('terms');
    expect(legalKindOf('/privacy/index.html')).toBe('privacy');
    expect(legalKindOf('/')).toBeNull();
    expect(legalKindOf('/embed')).toBeNull();
    expect(legalKindOf('/terms-and-more')).toBeNull();
  }, SLOW);

  it('renders both pages with the draft marker, a version and each other linked', async () => {
    const { LegalPage, DRAFT_LABEL } = await import('../src/ui/legal/LegalPage');
    expect(DRAFT_LABEL).toBe('Draft – pending legal review');
    for (const kind of ['terms', 'privacy'] as const) {
      const html = renderToStaticMarkup(createElement(LegalPage, { kind }));
      expect(html).toContain(DRAFT_LABEL);
      expect(html).toMatch(/Version 20\d\d-\d\d-\d\d/);
      expect(html).toContain(kind === 'terms' ? 'Terms of Service' : 'Privacy policy');
      expect(hrefs(html)).toContain(kind === 'terms' ? '/privacy' : '/terms');
      expect(html).toContain('mailto:team@gullylabs.xyz');
    }
  }, SLOW);

  it('reuses the Gully Labs terms text without new promises (no governing law guessed)', async () => {
    const src = readFileSync(resolve(app, 'src/ui/legal/LegalPage.tsx'), 'utf8');
    expect(src).toContain('export const GOVERNING_LAW: string | null = null;');
    expect(src).toContain('the place where Gully Labs is established');
    expect(src).toContain('limited to the greater of the amount you paid Gully Labs');
    expect(src).not.toMatch(/guarantee|insured|we will refund|refund you/i);
  });

  it('links Terms and Privacy in the full footer and in the embed footer', async () => {
    const { Footer } = await import('../src/ui/common/parts');
    for (const minimal of [false, true]) {
      const html = renderToStaticMarkup(createElement(Footer, { minimal }));
      expect(hrefs(html), `minimal=${minimal}`).toEqual(expect.arrayContaining(['/terms', '/privacy']));
      expect(html).toContain('aria-label="Legal"');
    }
  }, SLOW);

  it('index.html no longer points privacy at an off-site page only', () => {
    const html = readFileSync(resolve(app, 'index.html'), 'utf8');
    expect(html).toContain('Privacy: /privacy');
  });
});

describe('testnet vs mainnet chrome', () => {
  it('testnet: faucet in header and footer, Testnet pill, no caps note', async () => {
    const { Footer, CapsNote, TestnetTag } = await import('../src/ui/common/parts');
    const { Header } = await import('../src/ui/common/shell');
    const foot = renderToStaticMarkup(createElement(Footer, {}));
    const head = renderToStaticMarkup(createElement(Header));
    expect(hrefs(foot)).toContain('https://faucet.gullychain.xyz');
    expect(hrefs(head)).toContain('https://faucet.gullychain.xyz');
    expect(head).toContain('Testnet');
    expect(foot).toContain('Testnet: no real value.');
    expect(renderToStaticMarkup(createElement(CapsNote))).toBe('');
    expect(renderToStaticMarkup(createElement(TestnetTag))).toContain('Testnet');
  }, SLOW);

  it('mainnet: no faucet, no Testnet copy, the Phase 1 limits shown', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_NETWORK', 'mainnet');
    const { Footer, CapsNote, TestnetTag } = await import('../src/ui/common/parts');
    const { Header } = await import('../src/ui/common/shell');
    const foot = renderToStaticMarkup(createElement(Footer, {}));
    const head = renderToStaticMarkup(createElement(Header));
    for (const html of [foot, head]) {
      expect(html).not.toMatch(/faucet/i);
      expect(html).not.toMatch(/testnet/i);
    }
    expect(head).toContain('Mainnet');
    expect(hrefs(foot)).toEqual(expect.arrayContaining(['/terms', '/privacy', 'https://explorer.gullychain.xyz']));
    expect(renderToStaticMarkup(createElement(TestnetTag))).toBe('');
    const caps = renderToStaticMarkup(createElement(CapsNote));
    expect(caps).toContain('Phase 1 limits');
    expect(caps).toContain('up to 2 ETH per transfer');
    expect(caps).toContain('25 ETH in total');
    expect(caps).toContain('Canonical bridge: 100 ETH in total');
  }, SLOW);
});
