import * as Sentry from '@sentry/nextjs';
import { sentryDefaultConfig } from './sentry.default.config';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    ...sentryDefaultConfig,
    integrations: [
      Sentry.breadcrumbsIntegration({
        console: false,
        dom: false,
        fetch: false,
        history: false,
        sentry: false,
        xhr: false,
      }),
      Sentry.captureConsoleIntegration({
        levels: ['error'],
      }),
      Sentry.dedupeIntegration(),
      Sentry.functionToStringIntegration(),
      Sentry.globalHandlersIntegration(),
      Sentry.httpContextIntegration(),
    ],
  });
}
