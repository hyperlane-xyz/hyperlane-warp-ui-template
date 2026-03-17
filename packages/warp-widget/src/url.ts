import type { WarpWidgetConfig } from './types.js';

export const EMBED_BASE_URL =
  'https://hyperlane-warp-template-git-xaroz-warp-widget-sdk-abacus-works.vercel.app/embed';
const HEX_RE = /^#?[0-9a-fA-F]{3,8}$/;

/** Strip leading # from hex color values */
function normalizeHex(value: string): string {
  return value.replace(/^#/, '');
}

/** Build the full embed URL from a widget config. */
export function buildEmbedUrl(config?: WarpWidgetConfig): string {
  const params = new URLSearchParams();

  if (config?.theme) {
    const { mode, ...colors } = config.theme;
    if (mode) params.set('mode', mode);
    for (const [key, value] of Object.entries(colors)) {
      if (typeof value === 'string' && HEX_RE.test(value)) {
        params.set(key, normalizeHex(value));
      }
    }
  }

  if (config?.defaults) {
    const { origin, destination, originToken, destinationToken } = config.defaults;
    if (origin) params.set('origin', origin);
    if (destination) params.set('destination', destination);
    if (originToken) params.set('originToken', originToken);
    if (destinationToken) params.set('destinationToken', destinationToken);
  }

  if (config?.routes?.length) {
    params.set('routes', config.routes.join(','));
  }

  const query = params.toString();
  return query ? `${EMBED_BASE_URL}?${query}` : EMBED_BASE_URL;
}
