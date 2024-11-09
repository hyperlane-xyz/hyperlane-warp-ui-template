const filters = [
  // Hyperlane custom set
  "trap returned falsish for property", // Error from cosmos wallet lib
  "not established yet", // Same, bug with their WC integration ^
  "Refused to create a WebAssembly object", // CSP blocking wasm
  "call to WebAssembly.instantiate", // Same ^
  "Request rejected", // Unknown noise during Next.js init
  "WebSocket connection failed for host", // WalletConnect flakiness
  "Socket stalled when trying to connect", // Same ^
  "Request expired. Please try again.", // Same^
  "Failed to publish payload", // Same ^
  // Some recommendations from https://docs.sentry.io/platforms/javascript/configuration/filtering
  "top.GLOBALS",
  "originalCreateNotification",
  "canvas.contentDocument",
  "MyApp_RemoveAllHighlights",
  "atomicFindClose",
  "Wallet is not initialized",
  "region has been blocked from accessing this service"
]

export const sentryDefaultConfig = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.01,
  maxBreadcrumbs: 1,
  sendClientReports: false,
  attachStacktrace: false,
  defaultIntegrations: false,
  integrations: [],
  beforeSend(event, hint) {
    if (event && event.message && 
      filters.find((f) => event.message.match(f))) 
    {
      return null;
    }

    const error = hint.originalException;
    if (error && error.message && 
      filters.find((f) => error.message.match(f))) 
    {
      return null;
    } 

    delete event.user;
    return event;
  },
  ignoreErrors: filters,
  denyUrls: [
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
  ],
};
