// @ts-ignore
import { theme } from '../../tailwind.config';

const themeColors = theme.extend.colors as unknown as Record<string, string>;

export const Color = {
  black: themeColors.black,
  white: themeColors.white,
  gray: themeColors.gray,
  primary: themeColors.primary,
  accent: themeColors.accent,
  red: themeColors.red,
} as const;
