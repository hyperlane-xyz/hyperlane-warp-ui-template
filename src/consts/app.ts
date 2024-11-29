import { Space_Grotesk as SpaceGrotesk } from 'next/font/google';
import { Color } from '../styles/Color';

export const MAIN_FONT = SpaceGrotesk({
  subsets: ['latin'],
  variable: '--font-main',
  preload: true,
  fallback: ['sans-serif'],
});
export const APP_NAME = 'Hyperlane Renzo Bridge';
export const APP_DESCRIPTION = 'A token bridge for ezETH transfers, created by Hyperlane';
export const APP_URL = 'renzo.hyperlane.xyz';
export const BRAND_COLOR = Color.primary;
export const BACKGROUND_COLOR = Color.primary;
export const BACKGROUND_IMAGE = 'url(/backgrounds/main.svg)';
