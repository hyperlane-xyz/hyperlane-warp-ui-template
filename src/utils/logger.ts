/* eslint-disable no-console */
import { captureException } from '@sentry/nextjs';
import { config } from '../consts/config';

export const logger = {
  debug: (...args: any[]) => console.debug(...args),
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (message: string, err: any, ...args: any[]) => {
    console.error(message, err, ...args);
    if (!config.isDevMode) {
      const filteredArgs = args.filter(isSafeSentryArg);
      const extra = filteredArgs.reduce((acc, arg, i) => ({ ...acc, [`arg${i}`]: arg }), {});
      extra['message'] = message;
      captureException(err, { extra });
    }
  },
};

// First line of defense. Scrubbing is also configured in sentry.config.* files
function isSafeSentryArg(arg: any) {
  if (typeof arg == 'number') return true;
  if (typeof arg == 'string') return arg.length < 1000;
  return false;
}
