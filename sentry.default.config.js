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
};
