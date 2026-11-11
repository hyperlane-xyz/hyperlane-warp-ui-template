#!/usr/bin/env node
// Writes <dist>/sw.js and <dist>/sw-config.json from load/sw-template.js after a build.
//   node load/build-sw.mjs <dist> --prefix gully-explorer --never /api,/rpc --pages /,/blocks [--fallback /]
// The precache is the listed pages plus the JS and CSS the first page loads, read from its HTML, so it follows the build.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstLoadFiles } from './first-load.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const dist = argv[0];
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i > 0 ? argv[i + 1] : d; };
const pages = opt('pages', '/').split(',');
const never = opt('never', '').split(',').filter(Boolean);
const fallback = opt('fallback', '/');
const prefix = opt('prefix', 'gully-app');
if (!dist || !existsSync(join(dist, 'index.html'))) { console.error('usage: build-sw.mjs <dist> --prefix <name> --never /api,/rpc --pages /,/x'); process.exit(2); }

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = firstLoadFiles(html, dist).map((f) => f.path).filter((p) => p.startsWith('/assets/') && !/[?]/.test(p));
const precache = [...new Set([...pages, ...assets])];
const version = createHash('sha256').update(precache.map((p) => { const f = join(dist, p === '/' ? 'index.html' : p.endsWith('/') || !p.includes('.') ? `${p}/index.html` : p); return existsSync(f) ? readFileSync(f) : p; }).join('|')).update(html).digest('hex').slice(0, 12);
const sw = readFileSync(join(HERE, 'sw-template.js'), 'utf8')
  .replace('__VERSION__', () => version)
  .replace('__PREFIX__', () => prefix)
  .replace('__PRECACHE__', () => JSON.stringify(precache))
  .replace('__NEVER__', () => JSON.stringify(never))
  .replace('__FALLBACK__', () => JSON.stringify(fallback));
writeFileSync(join(dist, 'sw.js'), sw);
if (!existsSync(join(dist, 'sw-config.json'))) writeFileSync(join(dist, 'sw-config.json'), '{"kill":false}\n');
console.log(`sw.js ${version}: ${precache.length} files precached, never cached: ${never.join(' ') || '(none)'}`);
