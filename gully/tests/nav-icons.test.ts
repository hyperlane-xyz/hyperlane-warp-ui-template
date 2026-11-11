// Owner rule 2026-10-30 ("need icons on the whole stack"): every navigation item on the bridge (header nav, which is
// also the mobile menu, and the footer links) carries a Lucide icon svg next to its text label. Renders the real Header
// and Footer to static markup and fails on any link without an <svg>. The gc-switcher is a byte copy of gully-ops (a
// custom element that needs a DOM), so it is stubbed out; it is not part of this check.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/gc-switcher/GullyChainSwitcher', () => ({ GullyChainSwitcher: () => null }));

const app = resolve(__dirname, '..');
// the first import of the shell pulls in the wallet stack, which is slow on a cold transform cache
const SLOW = 120_000;

/** Inner HTML of every `<tag>` whose opening tag matches `open` (depth-aware for the same tag name). */
function blocks(html: string, tag: string, open: RegExp): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'g');
  const stack: { start: number; keep: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('</')) {
      const top = stack.pop();
      if (top?.keep) out.push(html.slice(top.start, m.index));
    } else stack.push({ start: m.index + m[0].length, keep: open.test(m[0]) });
  }
  return out;
}
const links = (html: string) =>
  blocks(html, 'a', /^<a\b/).map((inner) => ({ label: inner.replace(/<[^>]+>/g, '').trim(), icon: /<svg\b/.test(inner) }));

describe('nav icons on every bridge navigation item (owner rule 2026-10-30)', () => {
  it('header nav (also the mobile menu): every link has an icon svg and a text label', async () => {
    const { Header } = await import('../src/ui/common/shell');
    const html = renderToStaticMarkup(createElement(Header));
    const nav = blocks(html, 'nav', /aria-label="Main"/);
    expect(nav).toHaveLength(1);
    const items = links(nav[0]!);
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items.filter((i) => !i.icon).map((i) => i.label)).toEqual([]);
    for (const i of items) expect(i.label.length, 'label kept').toBeGreaterThan(0);
  }, SLOW);

  it('footer links: every link has an icon svg and a text label', async () => {
    const { Footer } = await import('../src/ui/common/parts');
    const html = renderToStaticMarkup(createElement(Footer, {}));
    const nav = blocks(html, 'nav', /class="foot-links"/);
    expect(nav).toHaveLength(1);
    const items = links(nav[0]!);
    expect(items.length).toBeGreaterThanOrEqual(11);
    expect(items.filter((i) => !i.icon).map((i) => i.label)).toEqual([]);
    for (const i of items) expect(i.label.length, 'label kept').toBeGreaterThan(0);
  }, SLOW);

  it('icon style: 20 px, stroke 1.75, muted (--gn-text-3) by default, mint (--gn-link) when active', () => {
    const icons = readFileSync(join(app, 'src/ui/common/icons.tsx'), 'utf8');
    expect(icons).toMatch(/size = 20/);
    expect(icons).toMatch(/strokeWidth=\{1\.75\}/);
    const css = readFileSync(join(app, 'src/styles/night.css'), 'utf8');
    expect(css).toContain('.nav-l svg, .foot-links a svg { width: 20px; height: 20px; flex: none; color: var(--gn-text-3); }');
    expect(css).toContain('.nav-on svg { color: var(--gn-link); }');
  });
});
