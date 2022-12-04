import { useCallback, useEffect, useRef } from 'react';

// https://usehooks-typescript.com/react-hook/use-interval
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void | null>();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  });

  // Set up the interval.
  useEffect(() => {
    const tick = () => {
      if (typeof savedCallback?.current !== 'undefined') {
        savedCallback?.current();
      }
    };

    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }

    return undefined;
  }, [delay]);
}

// https://medium.com/javascript-in-plain-english/usetimeout-react-hook-3cc58b94af1f
export const useTimeout = (
  callback: () => void,
  delay = 0, // in ms (default: immediately put into JS Event Queue)
): (() => void) => {
  const timeoutIdRef = useRef<NodeJS.Timeout>();

  const cancel = useCallback(() => {
    const timeoutId = timeoutIdRef.current;
    if (timeoutId) {
      timeoutIdRef.current = undefined;
      clearTimeout(timeoutId);
    }
  }, [timeoutIdRef]);

  useEffect(() => {
    if (delay >= 0) {
      timeoutIdRef.current = setTimeout(callback, delay);
    }
    return cancel;
  }, [callback, delay, cancel]);

  return cancel;
};

export async function fetchWithTimeout(
  resource: RequestInfo,
  options?: RequestInit,
  timeout = 10000,
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);
  return response;
}

export function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(() => resolve(true), milliseconds));
}

export const PROMISE_TIMEOUT = '__promise_timeout__';

export async function promiseTimeout<T>(promise: Promise<T>, milliseconds: number) {
  // Create a promise that rejects in <ms> milliseconds
  const timeout = new Promise<T>((_resolve, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(PROMISE_TIMEOUT));
    }, milliseconds);
  });
  // Awaits the race, which will throw on timeout
  const result = await Promise.race([promise, timeout]);
  return result;
}

export function asyncTimeout<P extends Array<any>, R>(
  inner: (...args: P) => Promise<R>,
  timeout: number,
) {
  return async (...args: P): Promise<R> => {
    const resultP = inner(...args);
    const result = await promiseTimeout(resultP, timeout);
    return result;
  };
}
