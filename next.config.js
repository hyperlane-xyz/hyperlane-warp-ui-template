/** @type {import('next').NextConfig} */

const { version } = require('./package.json');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const isDev = process.env.NODE_ENV !== 'production';

// Preserve ergonomic widget barrel imports while compiling them to narrow
// public entrypoints. Browser SDK value imports use subpaths directly because
// its public exports are not yet complete enough for a total name-to-path transform.
// Every widget value import must be mapped here. TypeScript does not validate
// these rewrite targets, so the production build is the validation boundary.
const HYPERLANE_WIDGET_IMPORTS = {
  ArrowIcon: '@hyperlane-xyz/widgets/icons/Arrow',
  Button: '@hyperlane-xyz/widgets/components/Button',
  ChainDetailsMenu: '@hyperlane-xyz/widgets/chains/ChainDetailsMenu',
  ChainLogo: '@hyperlane-xyz/widgets/chains/ChainLogo',
  ChevronIcon: '@hyperlane-xyz/widgets/icons/Chevron',
  Circle: '@hyperlane-xyz/widgets/icons/Circle',
  CopyButton: '@hyperlane-xyz/widgets/components/CopyButton',
  DropdownMenu: '@hyperlane-xyz/widgets/layout/DropdownMenu',
  ErrorBoundary: '@hyperlane-xyz/widgets/components/ErrorBoundary',
  FuelPumpIcon: '@hyperlane-xyz/widgets/icons/FuelPump',
  FunnelIcon: '@hyperlane-xyz/widgets/icons/Funnel',
  GithubIcon: '@hyperlane-xyz/widgets/icons/Github',
  HyperlaneLogo: '@hyperlane-xyz/widgets/logos/Hyperlane',
  IconButton: '@hyperlane-xyz/widgets/components/IconButton',
  MessageStage: '@hyperlane-xyz/widgets/messages/types',
  MessageStatus: '@hyperlane-xyz/widgets/messages/types',
  MessageTimeline: '@hyperlane-xyz/widgets/messages/MessageTimeline',
  Modal: '@hyperlane-xyz/widgets/layout/Modal',
  PROTOCOL_TO_LOGO: '@hyperlane-xyz/widgets/logos/protocols',
  PencilIcon: '@hyperlane-xyz/widgets/icons/Pencil',
  PlusIcon: '@hyperlane-xyz/widgets/icons/Plus',
  RefreshIcon: '@hyperlane-xyz/widgets/icons/Refresh',
  SearchIcon: '@hyperlane-xyz/widgets/icons/Search',
  Skeleton: '@hyperlane-xyz/widgets/animations/Skeleton',
  SpinnerIcon: '@hyperlane-xyz/widgets/icons/Spinner',
  Tooltip: '@hyperlane-xyz/widgets/components/Tooltip',
  UpDownArrowsIcon: '@hyperlane-xyz/widgets/icons/UpDownArrows',
  WarningIcon: '@hyperlane-xyz/widgets/icons/Warning',
  WideChevronIcon: '@hyperlane-xyz/widgets/icons/WideChevron',
  XCircleIcon: '@hyperlane-xyz/widgets/icons/XCircle',
  XIcon: '@hyperlane-xyz/widgets/icons/X',
  useDebounce: '@hyperlane-xyz/widgets/utils/debounce',
  useIsSsr: '@hyperlane-xyz/widgets/utils/ssr',
  useModal: '@hyperlane-xyz/widgets/layout/Modal',
  useTimeout: '@hyperlane-xyz/widgets/utils/timeout',
};

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

// Embed page headers: allow framing from specified origins (default: any)
// Accepts space or comma-separated origins, e.g. "https://a.com https://b.com" or "https://a.com,https://b.com"
const rawEmbedAllowedOrigins = process.env.NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS ?? '*';
const embedAllowedOrigins = rawEmbedAllowedOrigins
  .split(/[,\s]+/)
  .map((origin) => origin.trim())
  .filter(Boolean);

if (embedAllowedOrigins.length === 0) {
  throw new Error('Invalid NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS: no valid origins provided');
}

if (embedAllowedOrigins.some((origin) => /[;\r\n]/.test(origin))) {
  throw new Error('Invalid NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS: contains forbidden characters');
}

const embedCspHeader = cspHeader.replace(
  "frame-ancestors 'none'",
  `frame-ancestors ${embedAllowedOrigins.join(' ')}`,
);
const embedSecurityHeaders = [
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  // No X-Frame-Options — allow embedding
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  ...(ENABLE_CSP_HEADER
    ? [
        {
          key: 'Content-Security-Policy',
          value: embedCspHeader,
        },
      ]
    : []),
];

const nextConfig = {
  // Disable the dev-tools indicator/portal in dev when running under the
  // e2e harness — its <nextjs-portal> shadow DOM intermittently intercepts
  // pointer events during picker clicks (observed flake on
  // `token-select-destination` in full-suite runs). Scope to an explicit
  // env var so local dev UX is unchanged.
  ...(process.env.DISABLE_NEXT_DEV_INDICATORS === '1' ? { devIndicators: false } : {}),
  turbopack: {
    rules: {
      '*.yaml': {
        loaders: ['yaml-loader'],
        as: '*.js',
      },
      '*.yml': {
        loaders: ['yaml-loader'],
        as: '*.js',
      },
    },
    resolveAlias: {
      // Only shim pino on SSR (Node) where its transport/worker resolution breaks
      // under Turbopack. In the browser use the real pino browser build, which
      // exports `levels` that @walletconnect/logger depends on.
      pino: {
        browser: 'pino/browser.js',
        default: './src/utils/pino-noop.js',
      },
    },
  },

  async headers() {
    return [
      {
        source: '/embed',
        headers: embedSecurityHeaders,
      },
      {
        source: '/((?!embed$).*)',
        headers: securityHeaders,
      },
    ];
  },

  env: {
    NEXT_PUBLIC_VERSION: version,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  },

  reactStrictMode: true,

  modularizeImports: {
    '@hyperlane-xyz/widgets': {
      transform: HYPERLANE_WIDGET_IMPORTS,
      skipDefaultConversion: true,
    },
  },

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
    turbopackFileSystemCacheForBuild: true,
    parallelServerCompiles: true,
    parallelServerBuildTraces: true,
    optimizePackageImports: ['@hyperlane-xyz/registry', '@hyperlane-xyz/utils'],
  },

  // Skip type checking during builds — CI runs these separately
  typescript: { ignoreBuildErrors: true },
};

module.exports = withBundleAnalyzer(nextConfig);
