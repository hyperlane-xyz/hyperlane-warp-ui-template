import { sentryDefaultConfig } from '../sentry.default.config';

export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/nextjs');
    if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
      Sentry.init({ ...sentryDefaultConfig, defaultIntegrations: false });
    }
  } catch (error) {
    if (typeof process !== 'undefined' && process.stderr?.write) {
      process.stderr.write(`Failed to load Sentry instrumentation: ${String(error)}\n`);
    }
  }
}
