#!/usr/bin/env node
// The first-load gate of a Gully app (owner, 2026-11-06: "load instantly"). Fails the build when the served HTML has a
// full-screen loader or an empty body, when it has no h1, or when first-load JavaScript is over budget.
//   node load/first-load.mjs <dist> --budget-kb 150 [--min-words 30] [--html index.html,blocks/index.html]
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOADER = /(class|id)=["'][^"']*\b(app-loading|page-loader|full-?screen-?loader|splash(-?screen)?|preloader|boot-?screen|loading-?screen)\b/i;
const local = (u) => u.split('?')[0].split('#')[0];

/** Every same-origin script, modulepreload and stylesheet the HTML loads, and every static import inside those scripts. */
export function firstLoadFiles(html, dist) {
  const refs = new Set();
  const tags = html.match(/<(script|link)\b[^>]*>/gi) || [];
  for (const t of tags) {
    const src = /\b(?:src|href)=["']([^"']+)["']/i.exec(t)?.[1];
    if (!src || /^https?:|^\/\//i.test(src)) continue;
    if (/^<script/i.test(t) || /rel=["'](modulepreload|stylesheet)["']/i.test(t)) refs.add(src);
  }
  const seen = new Map(); const todo = [...refs];
  while (todo.length) {
    const ref = todo.pop().replace(/^\.\//, ''); const p = local(ref.startsWith('/') ? ref : `/${ref}`);
    if (seen.has(p)) continue;
    const f = join(dist, p);
    if (!existsSync(f)) continue;
    const body = readFileSync(f);
    seen.set(p, { path: p, bytes: gzipSync(body).length, js: p.endsWith('.js') });
    if (!p.endsWith('.js')) continue;
    // static imports only: `import("./x.js")` is on demand and is not part of the first load
    for (const m of body.toString('utf8').matchAll(/(?:^|[;}\n])\s*(?:import|export)\s*(?:[\w$*{},\s]+from\s*)?["']([^"']+\.js)["']/g)) {
      todo.push(m[1].startsWith('.') ? new URL(m[1], `http://x${p}`).pathname : m[1]);
    }
  }
  return [...seen.values()];
}

export const visibleText = (html) => html.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<head\b[\s\S]*?<\/head>/i, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Pure: the problems of one served HTML. */
export function htmlProblems(html, { minWords = 30 } = {}) {
  const out = [];
  const body = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
  if (LOADER.test(body)) out.push('a full-screen loader is in the served HTML');
  const words = visibleText(html).split(' ').filter(Boolean).length;
  if (words < minWords) out.push(`only ${words} words of text in the served HTML (at least ${minWords})`);
  if (!/<h1\b/i.test(body)) out.push('no h1 in the served HTML');
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2); const dist = argv[0];
  const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i > 0 ? argv[i + 1] : d; };
  const budget = Number(opt('budget-kb', '150')) * 1024; const minWords = Number(opt('min-words', '30'));
  const pages = opt('html', 'index.html').split(',');
  let failed = 0;
  for (const pg of pages) {
    const html = readFileSync(join(dist, pg), 'utf8');
    const files = firstLoadFiles(html, dist); const js = files.filter((f) => f.js);
    const total = js.reduce((s, f) => s + f.bytes, 0);
    console.log(`${pg}: ${(html.length / 1024).toFixed(1)} KB HTML (${(gzipSync(html).length / 1024).toFixed(1)} KB gzip), ${js.length} JS files, ${(total / 1024).toFixed(1)} KB gzip (budget ${budget / 1024} KB), ${visibleText(html).split(' ').length} words`);
    for (const f of js.sort((a, b) => b.bytes - a.bytes).slice(0, 6)) console.log(`  ${(f.bytes / 1024).toFixed(1).padStart(6)} KB ${f.path}`);
    const problems = htmlProblems(html, { minWords });
    if (total > budget) problems.push(`first-load JavaScript is ${(total / 1024).toFixed(1)} KB, over the ${budget / 1024} KB budget`);
    for (const p of problems) { console.error(`FAIL ${pg}: ${p}`); failed++; }
  }
  process.exit(failed ? 1 : 0);
}
