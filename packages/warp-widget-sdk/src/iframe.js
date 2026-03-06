const WIDGET_MESSAGE_TYPE = 'hyperlane-warp-widget';

function toBase64Url(input) {
  if (!input) return undefined;
  const json = JSON.stringify(input);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isWidgetEventMessage(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.type !== WIDGET_MESSAGE_TYPE) return false;
  if (!data.event || typeof data.event !== 'object') return false;
  return typeof data.event.type === 'string';
}

export function createWarpIframe(container, options) {
  if (!container) throw new Error('createWarpIframe requires a container element');

  const iframeUrl = options?.iframeUrl;
  if (!iframeUrl) throw new Error('createWarpIframe requires options.iframeUrl');

  const url = new URL(iframeUrl);
  const defaults = options?.config?.defaults;
  const encodedConfig = toBase64Url(options?.config);
  if (encodedConfig) {
    url.searchParams.set('config', encodedConfig);
  }
  if (typeof defaults?.originChain === 'string' && defaults.originChain) {
    url.searchParams.set('origin', defaults.originChain);
  }
  if (typeof defaults?.destinationChain === 'string' && defaults.destinationChain) {
    url.searchParams.set('destination', defaults.destinationChain);
  }
  if (typeof defaults?.token === 'string' && defaults.token) {
    url.searchParams.set('token', defaults.token);
  }

  const iframe = document.createElement('iframe');
  iframe.src = url.toString();
  iframe.style.width = '100%';
  iframe.style.height = options?.height || '720px';
  iframe.style.border = '0';
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox',
  );
  iframe.setAttribute('data-testid', 'warp-widget-iframe');

  const expectedOrigin = url.origin;
  const onMessage = (event) => {
    if (event.origin !== expectedOrigin) return;
    if (event.source !== iframe.contentWindow) return;
    if (!isWidgetEventMessage(event.data)) return;
    options?.onEvent?.(event.data.event);
  };

  window.addEventListener('message', onMessage);
  container.innerHTML = '';
  container.appendChild(iframe);

  return {
    iframe,
    destroy: () => {
      window.removeEventListener('message', onMessage);
      iframe.remove();
    },
  };
}

export { WIDGET_MESSAGE_TYPE };
