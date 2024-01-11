/* eslint-disable no-console */
import { captureException } from '@sentry/nextjs';

import { getAddressProtocolType } from '@hyperlane-xyz/utils';

export const logger = {
  debug: (...args: any[]) => console.debug(...args),
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (message: string, error: any, ...args: any[]) => {
    console.error(...args);
    const filteredArgs = args.filter(isSafeSentryArg);
    const extra = filteredArgs.reduce((acc, arg, i) => ({ ...acc, [`arg${i}`]: arg }), {});
    extra['message'] = message;
    captureException(error, { extra });
  },
};

function isSafeSentryArg(arg: any) {
  if (typeof arg == 'number') return true;
  if (typeof arg == 'string') return !getAddressProtocolType(arg) && arg.length < 1000;
  return false;
}
