import type { ParsedUrlQuery } from 'querystring';

import { logger } from './logger';

// To make Next's awkward query param typing more convenient
export function getQueryParamString(query: ParsedUrlQuery, key: string, defaultVal = '') {
  if (!query) return defaultVal;
  const val = query[key];
  if (val && typeof val === 'string') return val;
  else return defaultVal;
}

// Circumventing Next's router.replace method here because
// it's async and causes race conditions btwn components.
// This will only modify the url but not trigger any routing
export function replacePathParam(key: string, val: string) {
  try {
    const url = new URL(window.location.href);
    if (val) {
      url.searchParams.set(key, val);
    } else {
      url.searchParams.delete(key);
    }
    window.history.replaceState('', '', url);
  } catch (error) {
    logger.error('Error replacing path param', error);
  }
}
