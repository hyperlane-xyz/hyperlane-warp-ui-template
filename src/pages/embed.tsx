import type { NextPage } from 'next';
import type { CSSProperties } from 'react';
import { useEffect, useMemo } from 'react';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const WIDGET_MESSAGE_TYPE = 'hyperlane-warp-widget';

type EmbedTheme = {
  accentColor?: string;
  accentSoft?: string;
  accentTo?: string;
  backgroundColor?: string;
  cardColor?: string;
  textColor?: string;
  borderColor?: string;
  buttonTextColor?: string;
};

function parseConfigFromQuery(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  const encoded = new URLSearchParams(window.location.search).get('config');
  if (!encoded) return {};
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4;
    const padded = normalized + (pad ? '='.repeat(4 - pad) : '');
    const json = atob(padded);
    const decoded = JSON.parse(json);
    return typeof decoded === 'object' && decoded !== null ? decoded : {};
  } catch {
    return {};
  }
}

function parseThemeFromUrl(): EmbedTheme {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const config = parseConfigFromQuery();
  const configTheme = (config.theme || {}) as EmbedTheme;
  const fromParam = (keys: string[]) =>
    keys.map((key) => params.get(key)).find((value) => !!value) || undefined;
  return {
    accentColor: fromParam(['accent', 'accentColor']) || configTheme.accentColor,
    accentSoft: fromParam(['accentSoft']) || configTheme.accentSoft,
    accentTo: fromParam(['accentTo']) || configTheme.accentTo,
    backgroundColor: fromParam(['bg', 'background', 'backgroundColor']) || configTheme.backgroundColor,
    cardColor: fromParam(['card', 'cardColor']) || configTheme.cardColor,
    textColor: fromParam(['text', 'textColor']) || configTheme.textColor,
    borderColor: fromParam(['border', 'borderColor']) || configTheme.borderColor,
    buttonTextColor: fromParam(['buttonText', 'buttonTextColor']) || configTheme.buttonTextColor,
  };
}

function sanitizeColor(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (/^#[0-9a-fA-F]{3,8}$/.test(normalized)) return normalized;
  if (/^rgba?\([^)]+\)$/.test(trimmed)) return trimmed;
  return undefined;
}

const EmbedPage: NextPage = () => {
  const theme = useMemo(() => {
    const raw = parseThemeFromUrl();
    return {
      accentColor: sanitizeColor(raw.accentColor) || '#9A0DFF',
      accentSoft: sanitizeColor(raw.accentSoft) || '#F9D5FB',
      accentTo: sanitizeColor(raw.accentTo) || '#B959FF',
      backgroundColor: sanitizeColor(raw.backgroundColor) || '#F8F8FF',
      cardColor: sanitizeColor(raw.cardColor) || '#ffffff',
      textColor: sanitizeColor(raw.textColor) || '#010101',
      borderColor: sanitizeColor(raw.borderColor) || '#D9D9D9',
      buttonTextColor: sanitizeColor(raw.buttonTextColor) || '#ffffff',
    };
  }, []);

  useEffect(() => {
    document.body?.setAttribute('data-embed-theme', '1');
    document.documentElement?.setAttribute('data-embed-theme', '1');
    const targets = [document.body, document.documentElement].filter(Boolean) as HTMLElement[];
    for (const target of targets) {
      target.style.setProperty('--embed-accent', theme.accentColor);
      target.style.setProperty('--embed-accent-soft', theme.accentSoft);
      target.style.setProperty('--embed-accent-to', theme.accentTo);
      target.style.setProperty('--embed-bg', theme.backgroundColor);
      target.style.setProperty('--embed-card', theme.cardColor);
      target.style.setProperty('--embed-text', theme.textColor);
      target.style.setProperty('--embed-border', theme.borderColor);
      target.style.setProperty('--embed-button-text', theme.buttonTextColor);
    }
    const postReady = () => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: WIDGET_MESSAGE_TYPE,
            event: {
              type: 'ready',
              payload: { timestamp: Date.now() },
            },
          },
          '*',
        );
      }
    };
    postReady();
    const interval = window.setInterval(postReady, 2500);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 20000);
    return () => {
      document.body?.removeAttribute('data-embed-theme');
      document.documentElement?.removeAttribute('data-embed-theme');
      for (const target of targets) {
        target.style.removeProperty('--embed-accent');
        target.style.removeProperty('--embed-accent-soft');
        target.style.removeProperty('--embed-accent-to');
        target.style.removeProperty('--embed-bg');
        target.style.removeProperty('--embed-card');
        target.style.removeProperty('--embed-text');
        target.style.removeProperty('--embed-border');
        target.style.removeProperty('--embed-button-text');
      }
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [theme]);

  return (
    <main
      data-testid="warp-widget-root"
      data-embed-theme="1"
      style={
        {
          '--embed-accent': theme.accentColor,
          '--embed-accent-soft': theme.accentSoft,
          '--embed-accent-to': theme.accentTo,
          '--embed-bg': theme.backgroundColor,
          '--embed-card': theme.cardColor,
          '--embed-text': theme.textColor,
          '--embed-border': theme.borderColor,
          '--embed-button-text': theme.buttonTextColor,
        } as CSSProperties
      }
      className="flex min-h-screen items-center justify-center p-3"
    >
      <span data-testid="warp-widget-ready" className="hidden" />
      <TransferTokenCard />
      <style jsx global>{`
        [data-embed-theme='1'] {
          background: var(--embed-bg);
          color: var(--embed-text);
        }
        [data-embed-theme='1'] .bg-accent-gradient {
          background-image: linear-gradient(
            135deg,
            var(--embed-accent-to) 0%,
            var(--embed-accent) 100%
          ) !important;
        }
        [data-embed-theme='1'] .shadow-accent-glow {
          box-shadow: inset 0 0 10px var(--embed-accent-soft) !important;
        }
        [data-embed-theme='1'] .bg-card-gradient {
          background: var(--embed-card) !important;
        }
        [data-embed-theme='1'] .text-primary-500,
        [data-embed-theme='1'] .text-primary-600,
        [data-embed-theme='1'] .text-primary-700 {
          color: var(--embed-accent) !important;
        }
        [data-embed-theme='1'] .bg-primary-50,
        [data-embed-theme='1'] .border-primary-50 {
          border-color: var(--embed-border) !important;
          background-color: color-mix(in srgb, var(--embed-border) 25%, transparent) !important;
        }
        [data-embed-theme='1'] .border-gray-400,
        [data-embed-theme='1'] .border-gray-400\\/25,
        [data-embed-theme='1'] .border-gray-400\\/50,
        [data-embed-theme='1'] .border-gray-300 {
          border-color: var(--embed-border) !important;
        }
        [data-embed-theme='1'] .text-white {
          color: var(--embed-button-text) !important;
        }
        [data-embed-theme='1'] button.bg-accent-gradient {
          background-image: linear-gradient(
            135deg,
            var(--embed-accent-to) 0%,
            var(--embed-accent) 100%
          ) !important;
          color: var(--embed-button-text) !important;
        }
        body[data-embed-theme='1'] .htw-bg-white,
        body[data-embed-theme='1'] .bg-white {
          background-color: var(--embed-card) !important;
        }
        body[data-embed-theme='1'] .htw-text-black,
        body[data-embed-theme='1'] .text-black {
          color: var(--embed-text) !important;
        }
        body[data-embed-theme='1'] .htw-border-gray-100,
        body[data-embed-theme='1'] .htw-border-gray-200,
        body[data-embed-theme='1'] .border-gray-100,
        body[data-embed-theme='1'] .border-gray-200 {
          border-color: var(--embed-border) !important;
        }
        body[data-embed-theme='1'] .htw-bg-black\\/25 {
          background-color: color-mix(in srgb, var(--embed-bg) 70%, #000000 30%) !important;
        }
        body[data-embed-theme='1'] .htw-bg-gray-100,
        body[data-embed-theme='1'] .bg-gray-100 {
          background-color: color-mix(
            in srgb,
            var(--embed-card) 86%,
            var(--embed-border) 14%
          ) !important;
        }
        body[data-embed-theme='1'] .bg-gray-200,
        body[data-embed-theme='1'] .hover\\:bg-gray-200:hover {
          background-color: color-mix(
            in srgb,
            var(--embed-card) 78%,
            var(--embed-border) 22%
          ) !important;
        }
        body[data-embed-theme='1'] [role='dialog'] {
          background-color: var(--embed-card) !important;
          border: 1px solid var(--embed-border) !important;
        }
      `}</style>
    </main>
  );
};

export default EmbedPage;
