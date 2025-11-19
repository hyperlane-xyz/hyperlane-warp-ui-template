import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { afterEach, vi } from 'vitest';

vi.mock('@solana/wallet-adapter-react-ui/styles.css', () => ({}));

vi.mock('next/font/google', () => ({
  __esModule: true,
  Rubik: (options = {}) => ({
    className: options.className ?? 'rubik',
    style: { fontFamily: 'Rubik, sans-serif' },
    variable: options.variable ?? '--font-rubik',
  }),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props) => React.createElement('img', props),
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }) => {
    const resolvedHref = typeof href === 'string' ? href : (href?.pathname ?? '');
    return React.createElement('a', { href: resolvedHref, ...rest }, children);
  },
}));

vi.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }) => React.createElement(React.Fragment, null, children),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
