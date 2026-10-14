import { DEFAULT_UI_THEME_MODE, UiThemeMode } from '../consts/app';

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
