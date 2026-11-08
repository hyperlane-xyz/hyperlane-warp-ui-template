import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

import { AppA } from './ui/a/AppA';
import { AppB } from './ui/b/AppB';
import { AppC } from './ui/c/AppC';
import { Toaster } from './ui/common/toasts';
import { readUrl } from './ui/useBridge';
import { legalRedirect } from './config/legal';
import { fetchMirrorRoutes, MIRRORS_URL } from './config/mirrors';
import { setMirrorRoutes } from './config/routes';

// Integrator seam: when @gullylabs/bridge-sdk ships, register it here with setBridgeClient() (src/bridge/bridgeClient.ts).

// /terms and /privacy: Gully Chain's Terms and Privacy on gullychain.xyz (src/config/legal.ts). Caddy serves index.html
// for every path, so the app sends these two paths there before the bridge renders.
const legalTo = legalRedirect(location.pathname);

const direction = (new URLSearchParams(location.search).get('design') || import.meta.env.VITE_DIRECTION || 'c').toLowerCase();
const url = readUrl();
if (url.embed) {
  document.documentElement.classList.add('is-embed');
  window.parent?.postMessage({ type: 'gully-bridge', event: { type: 'ready', payload: { timestamp: Date.now() } } }, '*');
}
if (url.preview) document.documentElement.classList.add('is-preview');

// Caddy serves index.html for every path. Only "/" (any query) is the indexable page: the embed widget and unknown
// paths get noindex, and drop the canonical so noindex and a canonical to "/" do not send mixed signals.
const indexable = !url.embed && ['/', '/index.html'].includes(location.pathname);
if (!indexable) {
  document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, follow');
  document.querySelector('link[rel="canonical"]')?.remove();
  document.querySelector('meta[property="og:url"]')?.remove();
}

if (legalTo) {
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', legalTo);
  location.replace(legalTo);
  createRoot(document.getElementById('root')!).render(
    <main className="legal-redirect">
      <p>
        Opening <a href={legalTo}>{legalTo.replace('https://', '')}</a>
      </p>
    </main>,
  );
} else {
  const tree = (
    <StrictMode>
      {direction === 'a' ? <AppA url={url} /> : direction === 'b' ? <AppB url={url} /> : <AppC url={url} />}
      <Toaster />
    </StrictMode>
  );
  // The HTML is the landing page with no query: that one takes over in place. A deep link or the embed renders fresh.
  const landing = direction === 'c' && indexable && !location.search;
  // Mirror routes are added before the first render, so the page then differs from the prerendered one (it has none):
  // hydrating it fails with React error #418, so a page with mirror routes renders fresh instead of taking over.
  let mirrored = false;
  const render = () => {
    document.documentElement.classList.remove('gb-spa');
    const root = document.getElementById('root')!;
    if (landing && !mirrored) hydrateRoot(root, tree);
    else createRoot(root).render(tree);
  };

  // Gully Warp Mirrors: same-origin /mirrors.json (published every minute by the relayer sync on gully-l3) adds one Fast
  // route per active coin mirror before the first render, so a deep link ?token=&to= can preselect it. Missing file,
  // timeout or bad JSON = no mirror routes; the ETH routes and the default are unchanged either way.
  fetchMirrorRoutes(MIRRORS_URL, url.mirror ? 3000 : 1500)
    .then((routes) => {
      mirrored = routes.length > 0;
      setMirrorRoutes(routes);
    })
    .finally(render);
}

// Repeat visits paint from cache (load/build-sw.mjs). Registered after load so it never competes with first paint. This
// chunk is a dynamic import, which the load event does not wait for: it may already have fired.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const register = () => void navigator.serviceWorker.register('sw.js').catch(() => undefined);
  if (document.readyState === 'complete') register();
  else addEventListener('load', register);
}
