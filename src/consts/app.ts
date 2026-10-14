import { Color } from '../styles/Color';

<<<<<<< HEAD
export const MAIN_FONT = SpaceGrotesk({
  subsets: ['latin'],
  variable: '--font-main',
  preload: true,
  fallback: ['sans-serif'],
});
export const APP_NAME = 'Hyperlane Trump Bridge';
export const APP_DESCRIPTION = 'A token bridge for Trump transfers, created by Hyperlane';
export const APP_URL = 'https://trump.hyperlane.xyz/';
export const BRAND_COLOR = Color.primary['500'];
export const BACKGROUND_COLOR = Color.primary['500'];
export const BACKGROUND_IMAGE = 'url(/backgrounds/main.webp)';
=======
export type UiThemeMode = 'light' | 'dark';

export const APP_NAME = 'Hyperlane Warp UI Template';
export const APP_DESCRIPTION = 'A DApp for Hyperlane Warp Route transfers';
export const APP_URL = 'hyperlane-warp-template.vercel.app';
export const BRAND_COLOR = Color.primary['500'];

export const UI_THEME_STORAGE_KEY = 'warp-ui-theme';
export const DEFAULT_UI_THEME_MODE: UiThemeMode = 'light';
>>>>>>> origin/main
