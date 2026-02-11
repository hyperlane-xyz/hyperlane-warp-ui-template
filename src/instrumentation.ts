import { sentryDefaultConfig } from '../sentry.default.config';

export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({ ...sentryDefaultConfig, defaultIntegrations: false });
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({ ...sentryDefaultConfig, defaultIntegrations: false });
  }
}
