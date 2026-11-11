import { describe, expect, it } from 'vitest';
import { placeApp, splitLeadingLinks } from '../scripts/hoist-preloads.mjs';

// the live landing's renderToString output, 2026-11-11 (shortened)
const APP = '<link rel="preload" as="image" href="brand/logo/gc-icon.svg"/><link rel="preload" as="image" href="chains/arbitrum.svg"/><div class="a c"><a class="skip" href="#bridge">Skip to the bridge</a></div>';

describe('prerender: React resource hints go to <head>', () => {
  it('splits the leading links off', () => {
    const { head, body } = splitLeadingLinks(APP);
    expect(head).toBe('<link rel="preload" as="image" href="brand/logo/gc-icon.svg"/><link rel="preload" as="image" href="chains/arbitrum.svg"/>');
    expect(body.startsWith('<div class="a c">')).toBe(true);
  });
  it('leaves markup without leading links alone, and never moves a link inside the app', () => {
    expect(splitLeadingLinks('<div><link rel="x"/></div>')).toEqual({ head: '', body: '<div><link rel="x"/></div>' });
  });
  it('#root starts with the app, the preloads sit in <head>', () => {
    const page = placeApp('<html><head><title>t</title></head><body><div id="root"><!--gb-app--></div></body></html>', APP);
    expect(page).toContain('<div id="root"><div class="a c">');
    expect(page).toMatch(/<link rel="preload" as="image" href="chains\/arbitrum.svg"\/><\/head>/);
  });
});
