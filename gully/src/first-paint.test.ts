import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const text = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

describe('first paint', () => {
  it('the entry loads styles and nothing else before paint', () => {
    const main = text('src/main.tsx');
    expect(main.split(/\r?\n/).filter((l) => /^import /.test(l)).every((l) => l.startsWith("import './styles/"))).toBe(true);
    expect(main).toContain("import('./boot')");
  });
  it('the landing page takes over its HTML; anything else renders fresh', () => {
    const boot = text('src/boot.tsx');
    expect(boot).toContain('hydrateRoot(root, tree)');
    expect(boot).toContain('createRoot(root).render(tree)');
    expect(boot).toContain("classList.remove('gb-spa')");
  });
  it('the embed, previews and other paths never flash the landing page', () => {
    expect(text('index.html')).toContain("d.classList.add('gb-spa')");
    expect(text('src/styles/base.css')).toContain('.gb-spa #root > *');
  });
  it('the service worker registers even when the load event fired before this chunk arrived', () => {
    expect(text('src/boot.tsx')).toContain("document.readyState === 'complete'");
  });
  it('the service worker never touches RPC, quotes or the mirror list', () => {
    expect(text('scripts/build-staging.mjs')).toContain("'/rpc,/rpc-arb,/mirrors.json,/api,/stats,/price'");
  });
});
