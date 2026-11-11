import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = resolve(__dirname, '..');
const LOADER = '<script defer src="https://analytics.gullylabs.xyz/a.js"></script>';

describe('Gully analytics loader tag', () => {
  for (const f of ['index.html', 'picker/index.html']) {
    it(`${f} carries the one loader tag and no website id`, () => {
      const html = readFileSync(resolve(app, f), 'utf8');
      expect(html.split(LOADER).length - 1).toBe(1);
      expect(html).not.toMatch(/data-website-id|analytics\.gullychain\.xyz/);
    });
  }
  it('the bridge CSP allows the analytics host for scripts and requests', () => {
    const csp = readFileSync(resolve(app, 'deploy/Caddyfile.bridge'), 'utf8').match(/Content-Security-Policy "([^"]+)"/)?.[1] ?? '';
    const dir = (n: string) => csp.split(';').find((d) => d.trim().startsWith(n)) ?? '';
    expect(dir('script-src')).toContain('https://analytics.gullylabs.xyz');
    expect(dir('connect-src')).toContain('https://analytics.gullylabs.xyz');
    expect(csp).not.toContain('analytics.gullychain.xyz');
  });
});
