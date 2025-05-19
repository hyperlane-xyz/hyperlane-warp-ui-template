/** @type {import('next').NextConfig} */

const { version } = require('./package.json');
const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const isDev = process.env.NODE_ENV !== 'production';

// Sometimes useful to disable this during development
const ENABLE_CSP_HEADER = true;
const FRAME_SRC_HOSTS = [
  'https://*.walletconnect.com',
  'https://*.walletconnect.org',
  'https://cdn.solflare.com',
];
const STYLE_SRC_HOSTS = [];
const IMG_SRC_HOSTS = [
  'https://*.walletconnect.com',
  'https://*.githubusercontent.com',
  'https://cdn.jsdelivr.net/gh/hyperlane-xyz/hyperlane-registry@main/',
];
const cspHeader = `
  default-src 'self';
  script-src 'self'${isDev ? " 'unsafe-eval'" : ''};
  style-src 'self' 'unsafe-inline' ${STYLE_SRC_HOSTS.join(' ')};
  connect-src *;
  img-src 'self' blob: data: ${IMG_SRC_HOSTS.join(' ')};
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-src 'self' ${FRAME_SRC_HOSTS.join(' ')};
  frame-ancestors 'none';
  ${!isDev ? 'block-all-mixed-content;' : ''}
  ${!isDev ? 'upgrade-insecure-requests;' : ''}
`
  .replace(/\s{2,}/g, ' ')
  .trim();

const securityHeaders = [
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Note, causes a problem for firefox: https://github.com/MetaMask/metamask-extension/issues/3133
  ...(ENABLE_CSP_HEADER
    ? [
        {
          key: 'Content-Security-Policy',
          value: cspHeader,
        },
      ]
    : []),
];

const nextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /\.ya?ml$/,
      use: 'yaml-loader',
    });
    return config;
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  env: {
    NEXT_PUBLIC_VERSION: version,
  },

  reactStrictMode: true,
};

const sentryOptions = {
  org: 'hyperlane',
  project: 'warp-ui',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  tunnelRoute: '/monitoring-tunnel',
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
  },
};

module.exports = withBundleAnalyzer(withSentryConfig(nextConfig, sentryOptions));
