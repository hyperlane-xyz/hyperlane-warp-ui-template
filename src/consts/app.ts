import { Space_Grotesk as SpaceGrotesk } from 'next/font/google';
import { Color } from '../styles/Color';

export const MAIN_FONT = SpaceGrotesk({
  subsets: ['latin'],
  variable: '--font-main',
  preload: true,
  fallback: ['sans-serif'],
});
export const APP_NAME = 'Bridge OpenUSDT';
export const APP_DESCRIPTION = 'A DApp for OpenUSDT Warp Route transfers';
export const APP_URL = 'https://app.openusdt.xyz';
export const BRAND_COLOR = Color.primary['500'];
export const BACKGROUND_COLOR = Color.primary['700'];
export const BACKGROUND_IMAGE = 'url(/backgrounds/main.svg)';
