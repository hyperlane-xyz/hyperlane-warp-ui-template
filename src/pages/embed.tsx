import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useMemo } from 'react';
import { APP_NAME } from '../consts/app';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';
import { parseEmbedTheme, themeToCssVars } from '../styles/embedTheme';

/**
 * Embeddable widget page — renders the transfer form in a minimal, chrome-less
 * layout suitable for iframe embedding. Accepts theme overrides via URL params.
 *
 * Usage:
 *   <iframe src="https://your-warp-ui.com/embed?accent=3b82f6&bg=ffffff&mode=dark" />
 *
 * Supported URL params:
 *   - accent, bg, card, text, buttonText, border, error (hex without #)
 *   - mode: "dark" or "light"
 *   - origin, destination, originToken, destinationToken (transfer defaults)
 */

const WIDGET_MESSAGE_TYPE = 'hyperlane-warp-widget';

function emitWidgetEvent(eventType: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage(
    { type: WIDGET_MESSAGE_TYPE, event: { type: eventType, payload } },
    '*',
  );
}

function usePostMessageBridge() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;

    const send = () => emitWidgetEvent('ready', { timestamp: Date.now() });
    send();
    const timers = [500, 1500, 3000].map((ms) => setTimeout(send, ms));
    return () => timers.forEach(clearTimeout);
  }, []);
}

const EmbedPage: NextPage = () => {
  usePostMessageBridge();
  const cssVars = useMemo(() => themeToCssVars(parseEmbedTheme()), []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{APP_NAME}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="embed-container" style={cssVars as React.CSSProperties}>
        <div className="flex min-h-screen items-center justify-center p-2">
          <TransferTokenCard />
        </div>
      </div>
    </>
  );
};

export default EmbedPage;
