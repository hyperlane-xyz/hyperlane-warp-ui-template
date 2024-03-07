export const sentryDefaultConfig = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  maxBreadcrumbs: 1,
  sendClientReports: false,
  attachStacktrace: false,
  defaultIntegrations: false,
  integrations: [],
  beforeSend(event) {
    delete event.user;
    return event;
  },
  // Based on example from https://docs.sentry.io/platforms/javascript/configuration/filtering
  ignoreErrors: [
    // Hyperlane custom set
    "'defineProperty' on proxy", // Error from wallet lib
    "Refused to create a WebAssembly object", // CSP blocking wasm
    "call to WebAssembly.instantiate() blocked by CSP", // Same ^
    "Request rejected", // Unknown noise during Next.js init
    "WebSocket connection failed for host: wss://relay.walletconnect.org", // WalletConnect flakiness
    "Socket stalled when trying to connect to wss://relay.walletconnect.org", // Same ^
    // Some recommendations from https://docs.sentry.io/platforms/javascript/configuration/filtering
    "top.GLOBALS",
    "originalCreateNotification",
    "canvas.contentDocument",
    "MyApp_RemoveAllHighlights",
    "atomicFindClose",
  ],
  denyUrls: [
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
  ],
};
