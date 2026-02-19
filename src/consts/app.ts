import { Color } from '../styles/Color';

export type UiThemeMode = 'light' | 'dark';

export const APP_NAME = 'Hyperlane Warp UI Template';
export const APP_DESCRIPTION = 'A DApp for Hyperlane Warp Route transfers';
export const APP_URL = 'hyperlane-warp-template.vercel.app';
export const BRAND_COLOR = Color.primary['500'];

export const UI_THEME_STORAGE_KEY = 'warp-ui-theme';
export const DEFAULT_UI_THEME_MODE: UiThemeMode = 'light';

const LIGHT_BACKGROUND_COLOR = Color.cream['300'];
const LIGHT_BACKGROUND_IMAGE = `url(/backgrounds/main.svg), radial-gradient(120% 80% at 50% 100%, ${Color.primary['50']} 0%, #F2E4FF 60%, #F8F2FF 100%)`;
const DARK_BACKGROUND_COLOR = '#0d0612';
const DARK_BACKGROUND_IMAGE =
  'url(/backgrounds/main-dark.svg), radial-gradient(ellipse 200% 150% at 50% 100%, #5E1396 0%, #1a0a28 40%, #0d0612 100%)';

export function parseUiThemeMode(value: string | null | undefined): UiThemeMode | null {
  if (value === 'light' || value === 'dark') return value;
  return null;
}

export function getSystemUiThemeMode(): UiThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_UI_THEME_MODE;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getBackgroundStyleForTheme(mode: UiThemeMode): {
  color: string;
  image: string;
} {
  if (mode === 'dark') {
    return {
      color: DARK_BACKGROUND_COLOR,
      image: DARK_BACKGROUND_IMAGE,
    };
  }

  return {
    color: LIGHT_BACKGROUND_COLOR,
    image: LIGHT_BACKGROUND_IMAGE,
  };
}
