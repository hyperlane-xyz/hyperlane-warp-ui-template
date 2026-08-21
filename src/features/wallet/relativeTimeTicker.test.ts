import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startRelativeTimeTicker } from './relativeTimeTicker';

function createFakeDocument(initialVisibilityState: DocumentVisibilityState = 'visible') {
  let visibilityState = initialVisibilityState;
  const listeners = new Set<() => void>();

  return {
    get visibilityState() {
      return visibilityState;
    },
    setVisibilityState(nextVisibilityState: DocumentVisibilityState) {
      visibilityState = nextVisibilityState;
    },
    addEventListener(type: 'visibilitychange', listener: () => void) {
      if (type === 'visibilitychange') listeners.add(listener);
    },
    removeEventListener(type: 'visibilitychange', listener: () => void) {
      if (type === 'visibilitychange') listeners.delete(listener);
    },
    dispatchVisibilityChange() {
      listeners.forEach((listener) => listener());
    },
  };
}

describe('startRelativeTimeTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks immediately and on the configured interval', () => {
    const onTick = vi.fn();
    const documentObject = createFakeDocument();
    const stop = startRelativeTimeTicker({
      onTick,
      intervalMs: 30000,
      documentObject,
      timerApi: globalThis,
    });

    expect(onTick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30000);
    expect(onTick).toHaveBeenCalledTimes(2);

    stop();
  });

  it('ticks when the tab becomes visible again', () => {
    const onTick = vi.fn();
    const documentObject = createFakeDocument('hidden');
    const stop = startRelativeTimeTicker({
      onTick,
      intervalMs: 30000,
      documentObject,
      timerApi: globalThis,
    });

    expect(onTick).toHaveBeenCalledTimes(1);

    documentObject.setVisibilityState('visible');
    documentObject.dispatchVisibilityChange();

    expect(onTick).toHaveBeenCalledTimes(2);

    stop();
  });
});
