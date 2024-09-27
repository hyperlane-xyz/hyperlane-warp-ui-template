import { Inter } from 'next/font/google';

import { Color } from '../styles/Color';

export const MAIN_FONT = Inter({
  subsets: ['latin'],
  variable: '--font-main',
  preload: true,
  fallback: ['sans-serif'],
});
export const APP_NAME = 'Injective Token Bridge';
export const APP_DESCRIPTION = 'A token bridge for Injective powered by Hyperlane';
export const APP_URL = 'https://inevmbridge.com';
export const BRAND_COLOR = Color.primary;
export const BACKGROUND_COLOR = Color.primary;
export const BACKGROUND_IMAGE = 'url(/backgrounds/main.svg)';
export const PROXY_DEPLOYED_URL = 'https://proxy.hyperlane.xyz';
