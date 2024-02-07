import { sentryDefaultConfig } from './sentry.default.config';
import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    ...sentryDefaultConfig,
    integrations: [
      new Sentry.Integrations.Breadcrumbs({
        console: false,
        dom: false,
        fetch: false,
        history: false,
        sentry: false,
        xhr: false,
      }),
      new Sentry.Integrations.Dedupe(),
      new Sentry.Integrations.FunctionToString(),
      new Sentry.Integrations.GlobalHandlers(),
      new Sentry.Integrations.HttpContext(),
    ],
  });
}
