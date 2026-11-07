// node --test load/load.test.mjs   No network, no browser: the service worker runs against a small fake of the browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { firstLoadFiles, htmlProblems, visibleText } from './first-load.mjs';
import { verdict, median } from './lab.mjs';

const TEMPLATE = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
const ORIGIN = 'https://app.example';

function res(body, { status = 200, type = 'basic', redirected = false } = {}) {
  return { body, status, ok: status >= 200 && status < 300, type, redirected, clone() { return res(body, { status, type, redirected }); }, json: async () => JSON.parse(body) };
}
class FakeCache {
  constructor() { this.m = new Map(); }
  key(k) { return String(new URL(String(k), ORIGIN)); }
  async match(k) { return this.m.get(this.key(k)); }
  async put(k, v) { this.m.set(this.key(k), v); }
  async keys() { return [...this.m.keys()]; }
  async delete(k) { return this.m.delete(this.key(k)); }
}
function world(version, { precache = ['/', '/assets/a.js'], store = new Map(), net }) {
  const on = {};
  const caches = {
    open: async (n) => { if (!store.has(n)) store.set(n, new FakeCache()); return store.get(n); },
    keys: async () => [...store.keys()],
    delete: async (n) => store.delete(n),
  };
  const self = {
    location: { origin: ORIGIN }, addEventListener: (t, f) => { on[t] = f; }, skipWaiting: async () => {},
    clients: { claim: async () => {} }, registration: { unregister: async () => { self.unregistered = true; } },
  };
  const code = TEMPLATE.replace('__VERSION__', version).replace('__PREFIX__', 'gully-test').replace('__PRECACHE__', JSON.stringify(precache))
    .replace('__NEVER__', JSON.stringify(['/api', '/rpc'])).replace('__FALLBACK__', '"/"');
  new Function('self', 'caches', 'fetch', code)(self, caches, net);
  const lifecycle = async (t) => { const w = []; on[t]({ waitUntil: (p) => w.push(p) }); await Promise.all(w); };
  const request = async (path, { method = 'GET', mode = 'cors', origin = ORIGIN } = {}) => {
    let responded = null; const later = [];
    on.fetch({ request: { url: `${origin}${path}`, method, mode }, respondWith: (p) => { responded = p; }, waitUntil: (p) => later.push(p) });
    const r = responded ? await responded : 'passthrough';
    await Promise.all(later);
    return r;
  };
  return { self, store, lifecycle, request };
}
const netOf = (pages, log = []) => async (req) => {
  const u = typeof req === 'string' ? req : req.url;
  const p = u.replace(ORIGIN, '');
  log.push(p);
  if (p === '/sw-config.json') return res(pages.__config ?? '{"kill":false}');
  if (pages[p] === undefined) return res('missing', { status: 404 });
  return res(pages[p]);
};

test('install precaches the shell; a failed precache keeps the previous worker', async () => {
  const w = world('v1', { net: netOf({ '/': 'home-1', '/assets/a.js': 'a' }) });
  await w.lifecycle('install');
  assert.equal((await w.store.get('gully-test-shell-v1').match('/')).body, 'home-1');
  assert.equal((await w.store.get('gully-test-assets').match('/assets/a.js')).body, 'a');
  const bad = world('v2', { net: netOf({ '/': 'home-2' }) });
  await assert.rejects(bad.lifecycle('install'), /precache/);
});

test('a page paints from cache at once and the new version shows on the next navigation', async () => {
  const pages = { '/': 'home-1', '/assets/a.js': 'a' };
  const w = world('v1', { net: netOf(pages) });
  await w.lifecycle('install');
  pages['/'] = 'home-2'; // a deploy
  assert.equal((await w.request('/', { mode: 'navigate' })).body, 'home-1', 'this visit stays on the version it started with');
  assert.equal((await w.request('/', { mode: 'navigate' })).body, 'home-2', 'the next navigation is the new version');
});

test('a client route gets the app fallback, and the network when nothing is cached', async () => {
  const w = world('v1', { net: netOf({ '/': 'home', '/assets/a.js': 'a', '/tx/1': 'tx-page' }) });
  assert.equal((await w.request('/tx/1', { mode: 'navigate' })).body, 'tx-page', 'no cache yet');
  await w.lifecycle('install');
  assert.equal((await w.request('/block/9', { mode: 'navigate' })).status, 200);
});

test('a new version keeps old hashed chunks for open tabs and drops the old shell', async () => {
  const store = new Map();
  const pages = { '/': 'home-1', '/assets/a.js': 'a' };
  const w1 = world('v1', { store, net: netOf(pages) });
  await w1.lifecycle('install'); await w1.lifecycle('activate');
  pages['/'] = 'home-2'; pages['/assets/b.js'] = 'b'; delete pages['/assets/a.js'];
  const w2 = world('v2', { store, precache: ['/', '/assets/b.js'], net: netOf(pages) });
  await w2.lifecycle('install'); await w2.lifecycle('activate');
  assert.equal(store.has('gully-test-shell-v1'), false);
  assert.equal(store.has('gully-test-shell-v2'), true);
  assert.equal((await w2.request('/assets/a.js')).body, 'a', 'an old tab still gets its chunk though the server dropped it');
});

test('API, RPC, POSTs, other origins and the worker itself are never answered from cache', async () => {
  const log = [];
  const w = world('v1', { net: netOf({ '/': 'home', '/assets/a.js': 'a' }, log) });
  await w.lifecycle('install');
  for (const [p, o] of [['/api/x', {}], ['/rpc', { method: 'POST' }], ['/rpc', {}], ['/rpc/a', {}], ['/sw.js', {}], ['/sw-config.json', {}], ['/assets/a.js', { method: 'POST' }], ['/x.js', { origin: 'https://other.example' }]]) {
    assert.equal(await w.request(p, o), 'passthrough', `${o.method || 'GET'} ${p}`);
  }
  for (const c of w.store.values()) for (const k of await c.keys()) assert.ok(!/api|rpc/.test(k), k);
});

test('a page that is an error or a redirect is not stored', async () => {
  const pages = { '/': 'home', '/assets/a.js': 'a' };
  let mode = 'ok';
  const net = async (req) => { if (mode === 'down' && typeof req !== 'string' && req.mode === 'navigate') return res('boom', { status: 502 }); return netOf(pages)(req); };
  const w = world('v1', { net });
  await w.lifecycle('install');
  mode = 'down';
  assert.equal((await w.request('/', { mode: 'navigate' })).body, 'home');
  assert.equal((await w.request('/', { mode: 'navigate' })).body, 'home', 'a bad deploy does not replace the good page');
});

test('kill switch: the worker clears its caches and removes itself; the next load is the network', async () => {
  const pages = { '/': 'home', '/assets/a.js': 'a' };
  const w = world('v1', { net: netOf(pages) });
  await w.lifecycle('install');
  pages.__config = '{"kill":true}';
  await w.request('/', { mode: 'navigate' });
  assert.equal(w.self.unregistered, true);
  assert.equal(w.store.size, 0);
});

test('the gate: a full-screen loader, an empty body and a missing h1 fail; a real page passes', () => {
  const real = `<html><head><title>x</title></head><body><header><nav>Blocks Txs Tokens</nav></header><main><h1>Gully Explorer</h1><p>${'word '.repeat(40)}</p></main></body></html>`;
  assert.deepEqual(htmlProblems(real), []);
  assert.ok(htmlProblems('<html><body><div id="root"></div></body></html>').length >= 2);
  assert.match(htmlProblems(real.replace('<main>', '<div class="app-loading"></div><main>')).join(), /loader/);
  assert.match(htmlProblems(real.replace(/<h1>.*?<\/h1>/, '')).join(), /no h1/);
  assert.equal(htmlProblems('<html><body><style>.preloader{}</style><h1>a</h1>' + 'w '.repeat(40) + '</body></html>').length, 0, 'a rule in CSS is not a loader in the page');
  assert.ok(!visibleText('<head><title>t</title></head><script>x</script>y').includes('t y'.slice(0, 1) + 'x'));
});

test('the gate counts static imports and leaves dynamic ones out', () => {
  const d = mkdtempSync(join(tmpdir(), 'load-')); mkdirSync(join(d, 'assets'));
  writeFileSync(join(d, 'assets', 'main.js'), 'import{a}from"./dep.js";const v=()=>import("./lazy.js");console.log(a,v)');
  writeFileSync(join(d, 'assets', 'dep.js'), 'export const a=1');
  writeFileSync(join(d, 'assets', 'lazy.js'), 'export const b=2');
  const files = firstLoadFiles('<script type="module" src="/assets/main.js"></script><script src="https://other.example/a.js"></script>', d).map((f) => f.path).sort();
  assert.deepEqual(files, ['/assets/dep.js', '/assets/main.js']);
});

test('the lab limits', () => {
  assert.deepEqual(verdict({ lcpMs: 2400, cls: 0.05 }), []);
  assert.equal(verdict({ lcpMs: 2600, cls: 0.05 }).length, 1);
  assert.equal(verdict({ lcpMs: 2400, cls: 0.2 }).length, 1);
  assert.equal(verdict({ lcpMs: null, cls: 0 }).length, 1, 'no LCP is a failure, not a pass');
  assert.equal(median([3, 1, 2]), 2);
});
