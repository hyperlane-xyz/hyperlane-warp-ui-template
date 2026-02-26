/** @type {import('tailwindcss').Config} */

const defaultTheme = require('tailwindcss/defaultTheme');
const defaultColors = require('tailwindcss/colors');

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontFamily: {
      primary: ['PP Fraktion Mono', 'system-ui', 'sans-serif'],
      secondary: ['PP Valve', 'system-ui', 'sans-serif'],
      serif: ['Garamond', 'serif'],
    },
    screens: {
      all: '1px',
      xs: '480px',
      ...defaultTheme.screens,
    },
    extend: {
      colors: {
        black: '#010101',
        white: '#ffffff',
        cream: {
          100: '#FDFBFF',
          200: '#FCF9FE',
          300: '#F8F8FF',
        },
        gray: {
          ...defaultColors.gray,
          150: '#EBEDF0',
          250: '#404040',
          300: '#D9D9D9',
          350: '#6B6B6B',
          400: '#BFBFBF',
          450: '#B6B6B6',
          900: '#332840',
          950: '#221A2D',
        },
        primary: {
          25: '#E2C4FC',
          50: '#E8CAFF',
          100: '#D9A4FF',
          200: '#C97EFF',
          300: '#B959FF',
          400: '#AA33FF',
          500: '#9A0DFF',
          600: '#860FDC',
          700: '#7211B9',
          800: '#5E1396',
          900: '#4A1673',
        },
        accent: {
          25: '#F8F0FF',
          50: '#F9D5FB',
          100: '#FABAF8',
          200: '#FCA0F4',
          300: '#FD85F0',
          400: '#FE6AED',
          450: '#FF0D7E',
          500: '#D631B9',
          600: '#DA46CA',
          700: '#B53DAA',
          800: '#91358B',
          900: '#6C2C6C',
        },
        red: {
          100: '#EBBAB8',
          200: '#DF8D8A',
          300: '#D25F5B',
          400: '#C5312C',
          500: '#BF1B15',
          600: '#AB1812',
          700: '#85120E',
          800: '#5F0D0A',
          900: '#390806',
        },
        green: {
          50: '#00C467',
          100: '#BED5C9',
          200: '#93BAA6',
          300: '#679F82',
          400: '#3C835E',
          500: '#27764d',
          600: '#236A45',
          700: '#1F5E3D',
          800: '#17462E',
          900: '#0F2F1E',
        },
      },
      fontSize: {
        xxs: '0.7rem',
        xs: '0.775rem',
        sm: '0.85rem',
        md: '0.95rem',
      },
      spacing: {
        88: '22rem',
        100: '26rem',
        112: '28rem',
        128: '32rem',
        144: '36rem',
      },
      borderRadius: {
        none: '0',
        sm: '0.20rem',
        DEFAULT: '0.30rem',
        md: '0.40rem',
        lg: '0.50rem',
        full: '9999px',
      },
      blur: {
        xs: '3px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;',
      },
      backgroundImage: ({ theme }) => ({
        'app-gradient': `radial-gradient(81.94% 51.02% at 50% 100%, ${theme('colors.primary.50')} 0%, ${theme('colors.cream.300')} 100%)`,
        'accent-gradient': `radial-gradient(61.48% 118.8% at 50.08% 92%, ${theme('colors.primary.200')} 0%, ${theme('colors.primary.500')} 100%)`,
        'error-gradient': `radial-gradient(61.48% 118.8% at 50.08% 92%, ${theme('colors.accent.300')} 0%, ${theme('colors.accent.450')} 100%)`,
        'card-gradient': `linear-gradient(180deg, ${theme('colors.white')} 0%, ${theme('colors.cream.200')} 100%)`,
        'tip-card-gradient': `radial-gradient(74.42% 40.45% at 50% 100%, ${theme('colors.primary.50')} 0%, ${theme('colors.cream.300')} 100%)`,
      }),
      boxShadow: ({ theme }) => ({
        'accent-glow': `inset 2px 2px 13px 2px ${theme('colors.accent.100')}`,
        // Intentionally identical to accent-glow — error is differentiated via error-gradient background, not the glow
        'error-glow': `inset 2px 2px 13px 2px ${theme('colors.accent.100')}`,
        card: `0px 4px 6px ${theme('colors.gray.950')}1A`,
        button: `0 4px 6px ${theme('colors.gray.950')}1A`,
        input: `0 0 4px ${theme('colors.gray.400')}4D`,
      }),
      dropShadow: ({ theme }) => ({
        button: `0 4px 6px ${theme('colors.gray.950')}0D`,
      }),
      transitionProperty: {
        height: 'height, max-height',
        spacing: 'margin, padding',
      },
      maxWidth: {
        'xl-1': '39.5rem',
      },
    },
  },
  plugins: [],
};
