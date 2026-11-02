import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppA } from './ui/a/AppA';
import { AppB } from './ui/b/AppB';
import { AppC } from './ui/c/AppC';
import { Toaster } from './ui/common/toasts';
import { readUrl } from './ui/useBridge';
import { LegalPage, legalKindOf } from './ui/legal/LegalPage';
import './styles/night/tokens.css';
import './styles/base.css';
import './styles/a.css';
import './styles/b.css';
import './styles/c.css';
import './styles/night.css';

// Integrator seam: when @gullylabs/bridge-sdk ships, register it here with setBridgeClient() (src/bridge/bridgeClient.ts).

const direction = (new URLSearchParams(location.search).get('design') || import.meta.env.VITE_DIRECTION || 'c').toLowerCase();
const url = readUrl();
if (url.embed) {
  document.documentElement.classList.add('is-embed');
  window.parent?.postMessage({ type: 'gully-bridge', event: { type: 'ready', payload: { timestamp: Date.now() } } }, '*');
}
if (url.preview) document.documentElement.classList.add('is-preview');

// Caddy serves index.html for every path. Only "/" (any query) is the indexable page: the embed widget and unknown
// paths get noindex, and drop the canonical so noindex and a canonical to "/" do not send mixed signals.
// /terms and /privacy (the bridge's legal pages) are indexable too.
const legal = legalKindOf(location.pathname);
const indexable = !url.embed && (legal !== null || ['/', '/index.html'].includes(location.pathname));
if (!indexable) {
  document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, follow');
  document.querySelector('link[rel="canonical"]')?.remove();
  document.querySelector('meta[property="og:url"]')?.remove();
}
if (legal) {
  document.title = `${legal === 'terms' ? 'Terms of Service' : 'Privacy policy'} · Gully Bridge`;
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', new URL(`/${legal}`, location.origin).href);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', new URL(`/${legal}`, location.origin).href);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {legal ? <LegalPage kind={legal} /> : direction === 'a' ? <AppA url={url} /> : direction === 'b' ? <AppB url={url} /> : <AppC url={url} />}
    <Toaster />
  </StrictMode>,
);
