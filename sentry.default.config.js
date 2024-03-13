const filters = [
  // Hyperlane custom set
  "trap returned falsish for property", // Error from wallet lib
  "Refused to create a WebAssembly object", // CSP blocking wasm
  "call to WebAssembly.instantiate", // Same ^
  "Request rejected", // Unknown noise during Next.js init
  "WebSocket connection failed for host", // WalletConnect flakiness
  "Socket stalled when trying to connect", // Same ^
  // Some recommendations from https://docs.sentry.io/platforms/javascript/configuration/filtering
  "top.GLOBALS",
  "originalCreateNotification",
  "canvas.contentDocument",
  "MyApp_RemoveAllHighlights",
  "atomicFindClose",
]

export const sentryDefaultConfig = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.5,
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
