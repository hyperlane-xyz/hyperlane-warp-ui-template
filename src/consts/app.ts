import { Color } from '../styles/Color';

export type UiThemeMode = 'light' | 'dark';

export const APP_NAME = 'Hyperlane Nexus Bridge';
export const APP_DESCRIPTION =
  'Nexus is the interface for navigating the modular world. Bridge between any chains that are part of the expanding Modular universe. Built on Hyperlane.';
export const APP_URL = 'https://nexus.hyperlane.xyz/';
export const BRAND_COLOR = Color.primary['500'];

export const UI_THEME_STORAGE_KEY = 'warp-ui-theme';
export const DEFAULT_UI_THEME_MODE: UiThemeMode = 'light';
