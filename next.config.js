/** @type {import('next').NextConfig} */

const { version } = require('./package.json');
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
  'https://js.refiner.io',
  'https://intercom-sheets.com',
  'https://intercom-reporting.com',
];
const STYLE_SRC_HOSTS = ['https://js.refiner.io', 'https://storage.refiner.io'];
const IMG_SRC_HOSTS = [
  'https://*.walletconnect.com',
  'https://*.githubusercontent.com',
  'https://cdn.jsdelivr.net/gh/hyperlane-xyz/hyperlane-registry@main/',
  'https://js.refiner.io',
  'https://storage.refiner.io',
  'https://js.intercomcdn.com',
  'https://static.intercomassets.com',
  'https://downloads.intercomcdn.com',
  'https://uploads.intercomusercontent.com',
  'https://gifs.intercomcdn.com',
];
const SCRIPT_SRC_HOSTS = [
  'https://snaps.consensys.io',
  'https://js.refiner.io',
  'https://app.intercom.io',
  'https://widget.intercom.io',
  'https://js.intercomcdn.com',
];
const MEDIA_SRC_HOSTS = [
  'https://js.refiner.io',
  'https://storage.refiner.io',
  'https://js.intercomcdn.com',
  'https://downloads.intercomcdn.com',
];
const cspHeader = `
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''} ${SCRIPT_SRC_HOSTS.join(' ')};
  style-src 'self' 'unsafe-inline' ${STYLE_SRC_HOSTS.join(' ')};
  connect-src *;
  img-src 'self' blob: data: ${IMG_SRC_HOSTS.join(' ')};
  font-src 'self' data: https://js.intercomcdn.com https://fonts.intercomcdn.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-src 'self' ${FRAME_SRC_HOSTS.join(' ')};
  frame-ancestors 'none';
  media-src 'self' ${MEDIA_SRC_HOSTS.join(' ')};
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
  webpack(config, { isServer }) {
    config.module.rules.push({
      test: /\.ya?ml$/,
      use: 'yaml-loader',
    });

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // TODO: Remove when @hyperlane-xyz/core fixes ethers v5/v6 compat in typechain.
    // core's typechain does `import { utils } from 'ethers'` (v5 API) which fails
    // during barrel optimization with webpackBuildWorker enabled. Stub out the
    // third-party typechain barrels that re-export the broken factories.
    // See: https://github.com/hyperlane-xyz/hyperlane-warp-ui-template/pull/976
    config.resolve.alias = {
      ...config.resolve.alias,
      '@hyperlane-xyz/core/dist/tron': false,
      '@hyperlane-xyz/core/dist/typechain/@arbitrum': false,
      '@hyperlane-xyz/core/dist/typechain/@chainlink': false,
    };

    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@provablehq/wasm': false,
        '@provablehq/sdk': false,
      };
    }

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
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  },

  reactStrictMode: true,

  serverExternalPackages: ['@sentry/nextjs'],

  // Exclude heavy client-only chain SDKs from serverless function file tracing.
  // These packages are only used client-side and not needed in serverless functions.
  // Note: @sentry and @opentelemetry are kept for server-side instrumentation (see instrumentation.ts).
  outputFileTracingExcludes: {
    '*': [
      './node_modules/@provablehq/**',
      './node_modules/@radixdlt/**',
      './node_modules/@solana/**',
      './node_modules/@cosmjs/**',
      './node_modules/@starknet-io/**',
      './node_modules/ethers/**',
    ],
  },

  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    optimizePackageImports: [
      '@hyperlane-xyz/registry',
      '@hyperlane-xyz/sdk',
      '@hyperlane-xyz/utils',
      '@hyperlane-xyz/widgets',
    ],
  },

  // Skip linting and type checking during builds — CI runs these separately
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

module.exports = withBundleAnalyzer(nextConfig);
