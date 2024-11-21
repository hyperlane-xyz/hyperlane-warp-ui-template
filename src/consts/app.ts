import { Space_Grotesk } from 'next/font/google';
import { Color } from '../styles/Color';

export const MAIN_FONT = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-main',
  preload: true,
  fallback: ['sans-serif'],
});
export const APP_NAME = 'Hyperlane Nexus Bridge';
export const APP_DESCRIPTION =
  'Nexus is the interface for navigating the modular world. Bridge between any chains that are part of the expanding Modular universe. Built on Hyperlane.';
export const APP_URL = 'https://usenexus.org';
export const BRAND_COLOR = Color.primary;
export const BACKGROUND_COLOR = Color.primary;
export const BACKGROUND_IMAGE = 'url(/backgrounds/main.svg)';
