import { sentryDefaultConfig } from './sentry.default.config';
import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init(sentryDefaultConfig)
}
