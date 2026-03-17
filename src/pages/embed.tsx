import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useMemo } from 'react';
import { APP_NAME } from '../consts/app';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';
import { getQueryParams } from '../utils/queryParams';

/**
 * Embeddable widget page — renders the transfer form in a minimal, chrome-less
 * layout suitable for iframe embedding. Accepts theme overrides via URL params.
 *
 * Usage:
 *   <iframe src="https://your-warp-ui.com/embed?accent=3b82f6&bg=ffffff&mode=dark" />
 *
 * Supported URL params:
 *   - accent:       Primary/accent color (hex without #, e.g. "3b82f6")
 *   - bg:           Background color (hex without #)
 *   - card:         Card/surface background color (hex without #)
 *   - text:         Text color (hex without #)
 *   - buttonText:   Button text color (hex without #)
 *   - border:       Border color (hex without #)
 *   - error:        Error state color (hex without #, default: dc2626)
 *   - mode:         "dark" or "light" (applies preset overrides)
 *
 * Transfer params (same as main app):
 *   - origin, destination, originToken, destinationToken
 */

// --- Theme parsing ---

const HEX_COLOR_RE = /^[0-9a-fA-F]{3,8}$/;

function parseHexParam(params: URLSearchParams, name: string): string | null {
  const value = params.get(name);
  return value && HEX_COLOR_RE.test(value) ? `#${value}` : null;
}

function shiftColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// --- Theme types & defaults ---

interface EmbedTheme {
  accent: string;
  accentLight: string;
  accentDark: string;
  bg: string;
  card: string;
  text: string;
  buttonText: string;
  border: string;
  error: string;
}

const LIGHT_DEFAULTS: EmbedTheme = {
  accent: '#9A0DFF',
  accentLight: '#C97EFF',
  accentDark: '#7211B9',
  bg: 'transparent',
  card: '#ffffff',
  text: '#010101',
  buttonText: '#ffffff',
  border: '#BFBFBF40',
  error: '#dc2626',
};

const DARK_DEFAULTS: EmbedTheme = {
  accent: '#9A0DFF',
  accentLight: '#C97EFF',
  accentDark: '#7211B9',
  bg: '#1a1a2e',
  card: '#16213e',
  text: '#e0e0e0',
  buttonText: '#ffffff',
  border: '#ffffff20',
  error: '#ef4444',
};

// --- Hooks ---

function useEmbedTheme(): EmbedTheme {
  return useMemo(() => {
    if (typeof window === 'undefined') return LIGHT_DEFAULTS;

    const params = getQueryParams();
    const defaults = params.get('mode') === 'dark' ? DARK_DEFAULTS : LIGHT_DEFAULTS;
    const accent = parseHexParam(params, 'accent') || defaults.accent;

    return {
      accent,
      accentLight: shiftColor(accent, 60),
      accentDark: shiftColor(accent, -40),
      bg: parseHexParam(params, 'bg') || defaults.bg,
      card: parseHexParam(params, 'card') || defaults.card,
      text: parseHexParam(params, 'text') || defaults.text,
      buttonText: parseHexParam(params, 'buttonText') || defaults.buttonText,
      border: parseHexParam(params, 'border') || defaults.border,
      error: parseHexParam(params, 'error') || defaults.error,
    };
  }, []);
}

/** Sets CSS variables on <body> so portaled modals can read them. */
function useEmbedBodyClass(theme: EmbedTheme) {
  useEffect(() => {
    document.body.classList.add('embed-mode');
    const { style } = document.body;
    for (const [key, value] of Object.entries(theme)) {
      const varName = `--embed-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;
      style.setProperty(varName, value);
    }
    return () => document.body.classList.remove('embed-mode');
  }, [theme]);
}

/**
 * PostMessage event envelope.
 * Structured for forward compatibility — new event types can be added without
 * breaking existing host listeners that only check event.type.
 */
const WIDGET_MESSAGE_TYPE = 'hyperlane-warp-widget';

function emitWidgetEvent(eventType: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage(
    { type: WIDGET_MESSAGE_TYPE, event: { type: eventType, payload } },
    '*',
  );
}

/** Signals readiness to parent frame via postMessage with retry. */
function usePostMessageBridge() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;

    const send = () => emitWidgetEvent('ready', { timestamp: Date.now() });
    send();
    const timers = [500, 1500, 3000].map((ms) => setTimeout(send, ms));
    return () => timers.forEach(clearTimeout);
  }, []);
}

// --- Page ---

const EmbedPage: NextPage = () => {
  const theme = useEmbedTheme();
  useEmbedBodyClass(theme);
  usePostMessageBridge();

  // CSS variables as inline styles for .embed-container
  const cssVars = Object.fromEntries(
    Object.entries(theme).map(([key, value]) => [
      `--embed-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`,
      value,
    ]),
  );

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
