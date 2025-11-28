import { Figtree } from 'next/font/google';
import { Color } from '../styles/Color';

export const MAIN_FONT = Figtree({
  subsets: ['latin'],
  variable: '--font-main',
  preload: true,
  fallback: ['sans-serif'],
  weight: ['400', '500', '600', '700', '800', '900'],
});
export const APP_NAME = 'Runes Bridge';
export const APP_DESCRIPTION = 'A DApp for Hyperlane Warp Route transfers';
export const APP_URL = 'hyperlane-warp-template.vercel.app';
export const BRAND_COLOR = Color.primary['500'];
export const BACKGROUND_COLOR = '#c2b5f5';
export const BACKGROUND_IMAGE = 'url(/backgrounds/main.svg)';
