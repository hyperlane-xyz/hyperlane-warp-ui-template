import type { WarpWidgetEvent, WarpWidgetInstance, WarpWidgetOptions } from './types.js';
import { EMBED_BASE_URL, buildEmbedUrl } from './url.js';

export type { WarpWidgetConfig, WarpWidgetDefaults, WarpWidgetEvent, WarpWidgetInstance, WarpWidgetOptions, WarpWidgetTheme } from './types.js';
export { buildEmbedUrl } from './url.js';

const WIDGET_MESSAGE_TYPE = 'hyperlane-warp-widget';

/**
 * Create a Hyperlane Warp bridge widget iframe.
 *
 * @example
 * ```ts
 * const { iframe, destroy, on } = createWarpWidget({
 *   container: document.getElementById('widget'),
 *   config: {
 *     theme: { accent: '3b82f6', mode: 'dark' },
 *     routes: ['USDC/arbitrum-ethereum'],
 *   },
 * });
 *
 * on('ready', (payload) => console.log('Widget ready', payload));
 * ```
 */
export function createWarpWidget(options: WarpWidgetOptions): WarpWidgetInstance {
  const { container, config, width = '100%', height = '600px' } = options;
  const src = buildEmbedUrl(config);
  const expectedOrigin = new URL(EMBED_BASE_URL).origin;

  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.style.border = 'none';
  iframe.style.width = width;
  iframe.style.height = height;
  iframe.style.display = 'block';
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox',
  );
  iframe.setAttribute('allow', 'clipboard-write');
  container.appendChild(iframe);

  // Event system
  const listeners = new Map<string, Set<(payload?: Record<string, unknown>) => void>>();

  const onMessage = (event: MessageEvent) => {
    // 3-layer validation
    if (event.origin !== expectedOrigin) return;
    if (event.source !== iframe.contentWindow) return;
    if (!event.data || event.data.type !== WIDGET_MESSAGE_TYPE) return;

    const widgetEvent = event.data.event as WarpWidgetEvent | undefined;
    if (!widgetEvent?.type) return;

    const handlers = listeners.get(widgetEvent.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(widgetEvent.payload);
      }
    }
  };

  window.addEventListener('message', onMessage);

  const destroy = () => {
    window.removeEventListener('message', onMessage);
    listeners.clear();
    iframe.remove();
  };

  const on = (event: string, cb: (payload?: Record<string, unknown>) => void): (() => void) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(cb);
    return () => {
      listeners.get(event)?.delete(cb);
    };
  };

  return { iframe, destroy, on };
}
