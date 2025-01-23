import { useRouter } from 'next/router';
import { ParsedUrlQuery } from 'querystring';
import { useEffect } from 'react';
import { logger } from './logger';

// To make Next's awkward query param typing more convenient
export function getQueryParamString(query: ParsedUrlQuery, key: string, defaultVal = '') {
  if (!query) return defaultVal;
  const val = query[key];
  if (val && typeof val === 'string') return val;
  else return defaultVal;
}

export function useMultipleQueryParams(keys: string[]) {
  const router = useRouter();

  return keys.map((key) => {
    return getQueryParamString(router.query, key);
  });
}

// Keep value in sync with query param in URL
export function useSyncQueryParam(params: Record<string, string>) {
  const router = useRouter();
  const { pathname, query } = router;
  useEffect(() => {
    let hasChanged = false;
    const newQuery = new URLSearchParams(
      Object.fromEntries(
        Object.entries(query).filter((kv): kv is [string, string] => typeof kv[0] === 'string'),
      ),
    );
    Object.entries(params).forEach(([key, value]) => {
      if (value && newQuery.get(key) !== value) {
        newQuery.set(key, value);
        hasChanged = true;
      } else if (!value && newQuery.has(key)) {
        newQuery.delete(key);
        hasChanged = true;
      }
    });
    if (hasChanged) {
      const path = `${pathname}?${newQuery.toString()}`;
      router
        .replace(path, undefined, { shallow: true })
        .catch((e) => logger.error('Error shallow updating URL', e));
    }
    // Must exclude router for next.js shallow routing, otherwise links break:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
}
