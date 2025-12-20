/** @type {import('tailwindcss').Config} */

const defaultTheme = require('tailwindcss/defaultTheme');
const defaultColors = require('tailwindcss/colors');

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontFamily: {
      sans: ['var(--font-main)'],
      serif: ['Garamond', 'serif'],
      mono: ['Courier New', 'monospace'],
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
        gray: { ...defaultColors.gray, 150: '#EBEDF0', 250: '#404040', 350: '#6B6B6B' },
        primary: {
          50: '#FDE7EB',
          100: '#FACED6',
          200: '#F49CAB',
          300: '#EF6A7F',
          400: '#E83C58',
          500: '#B31942',
          600: '#8D1234',
          700: '#671026',
          800: '#420A18',
          900: '#1F040B',
        },
        accent: {
          50: '#E6ECF3',
          100: '#C5D2E4',
          200: '#94AFCF',
          300: '#648CB9',
          400: '#3B6CA8',
          500: '#0A3161',
          600: '#08274C',
          700: '#061C37',
          800: '#041328',
          900: '#020B17',
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
          50: '#D3E3DB',
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
