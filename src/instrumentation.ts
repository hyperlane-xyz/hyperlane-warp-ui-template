import * as Sentry from '@sentry/nextjs';
import { sentryDefaultConfig } from '../sentry.default.config';

export function register() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      Sentry.init({ ...sentryDefaultConfig, defaultIntegrations: false });
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
      Sentry.init({ ...sentryDefaultConfig, defaultIntegrations: false });
    }
  }
}
