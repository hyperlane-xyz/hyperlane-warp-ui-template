<<<<<<< HEAD
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
=======
import { Color } from '../styles/Color';
export const APP_NAME = 'Hyperlane Warp UI Template';
export const APP_DESCRIPTION = 'A DApp for Hyperlane Warp Route transfers';
export const APP_URL = 'hyperlane-warp-template.vercel.app';
>>>>>>> origin/main
export const BRAND_COLOR = Color.primary['500'];
export const BACKGROUND_COLOR = Color.cream['300'];
export const BACKGROUND_IMAGE = `url(/backgrounds/main.svg), radial-gradient(120% 80% at 50% 100%, ${Color.primary['50']} 0%, #F2E4FF 60%, #F8F2FF 100%)`;
