/* Gully app service worker. Generated at build from load/sw-template.js by load/build-sw.mjs: do not edit dist/sw.js.
 *
 * Repeat visits paint from cache at once; the network refreshes behind it.
 * - Pages: stale-while-revalidate. A deploy shows on the NEXT navigation, never in the middle of a visit.
 * - Hashed assets: cache first, kept across versions, so an open tab on an old build still finds its chunks.
 * - API, RPC, balances, claims, quotes, other origins: never touched. They go straight to the network.
 * - Kill switch: serve {"kill":true} at /sw-config.json. Every navigation reads it in the background; the worker then
 *   clears its caches and removes itself, and the next load comes from the network.
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__; // the shell pages and the hashed files of the first load
const NEVER = __NEVER__; // path prefixes that must always be fresh
const FALLBACK = __FALLBACK__; // the page the server answers for a client route
const PREFIX = '__PREFIX__';
const SHELL = `${PREFIX}-shell-${VERSION}`;
const ASSETS = `${PREFIX}-assets`;
const MAX_ASSETS = 120;

function strategy(request, origin) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== origin) return 'network';
  if (url.pathname === '/sw.js' || url.pathname === '/sw-config.json') return 'network';
  if (NEVER.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return 'network';
  if (request.mode === 'navigate') return 'page';
  if (url.pathname.startsWith('/assets/')) return 'asset';
  return 'network';
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(k);
}

async function refreshPage(request, shell, cacheKey) {
  const res = await fetch(request);
  if (res.ok && res.type === 'basic' && !res.redirected) await shell.put(cacheKey, res.clone());
  return res;
}

async function checkKill() {
  try {
    const r = await fetch('/sw-config.json', { cache: 'no-store' });
    if (!r.ok) return false;
    if ((await r.json()).kill !== true) return false;
  } catch { return false; }
  for (const k of await caches.keys()) if (k.startsWith(`${PREFIX}-`)) await caches.delete(k);
  await self.registration.unregister();
  return true;
}

async function page(event) {
  const url = new URL(event.request.url);
  const shell = await caches.open(SHELL);
  const own = await shell.match(url.pathname);
  const hit = own || (await shell.match(FALLBACK));
  const cacheKey = url.pathname;
  const fresh = refreshPage(event.request, shell, cacheKey);
  event.waitUntil(fresh.catch(() => undefined).then(() => checkKill()));
  if (hit) return hit;
  return fresh;
}

async function asset(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') { await cache.put(request.url, res.clone()); await trim(cache); }
  return res;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    const assets = await caches.open(ASSETS);
    for (const p of PRECACHE) {
      const res = await fetch(p, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`precache ${p}: HTTP ${res.status}`); // a failed install keeps the previous worker
      await (p.startsWith('/assets/') ? assets : shell).put(p, res);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith(`${PREFIX}-shell-`) && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const s = strategy(event.request, self.location.origin);
  if (s === 'page') event.respondWith(page(event));
  else if (s === 'asset') event.respondWith(asset(event.request));
});
