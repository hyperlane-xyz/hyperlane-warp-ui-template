import { getQueryParams } from '../utils/queryParams';

export interface EmbedTheme {
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

/** Parse embed theme from current URL query params. */
export function parseEmbedTheme(): EmbedTheme {
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
}

/** Convert theme object to CSS variable inline styles. */
export function themeToCssVars(theme: EmbedTheme): Record<string, string> {
  return Object.fromEntries(
    Object.entries(theme).map(([key, value]) => [
      `--embed-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`,
      value,
    ]),
  );
}
