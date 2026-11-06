// The prerender: the landing page as real HTML at build time (scripts/prerender.mjs). Effects do not run here, so nothing
// waits for a wallet or an RPC: live values render as their empty, content-shaped state.
import { renderToString } from 'react-dom/server';
import { StrictMode } from 'react';
import { AppC } from './ui/c/AppC';
import { Toaster } from './ui/common/toasts';
import { readUrl } from './ui/useBridge';

export const renderLanding = (): string =>
  renderToString(
    <StrictMode>
      <AppC url={readUrl()} />
      <Toaster />
    </StrictMode>,
  );
