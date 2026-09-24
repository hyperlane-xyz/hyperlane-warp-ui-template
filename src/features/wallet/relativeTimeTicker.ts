interface VisibilityDocument {
  visibilityState: DocumentVisibilityState;
  addEventListener: (
    type: 'visibilitychange',
    listener: () => void,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: 'visibilitychange',
    listener: () => void,
    options?: boolean | EventListenerOptions,
  ) => void;
}

interface StartRelativeTimeTickerOptions {
  onTick: () => void;
  intervalMs?: number;
  documentObject?: VisibilityDocument;
  timerApi?: Pick<typeof globalThis, 'setInterval' | 'clearInterval'>;
}

export function startRelativeTimeTicker({
  onTick,
  intervalMs = 30000,
  documentObject = document,
  timerApi = globalThis,
}: StartRelativeTimeTickerOptions) {
  onTick();

  const intervalId = timerApi.setInterval(onTick, intervalMs);
  const handleVisibilityChange = () => {
    if (documentObject.visibilityState === 'visible') onTick();
  };

  documentObject.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    timerApi.clearInterval(intervalId);
    documentObject.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
