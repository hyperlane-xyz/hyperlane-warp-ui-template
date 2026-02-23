function getImgSrc(img: HTMLImageElement): string {
  return img.getAttribute('src') || '';
}

const darkLogoAvailabilityCache = new Map<string, 'ok' | 'missing'>();
const DARK_LOGO_CACHE_MAX_ENTRIES = 500;

function setDarkLogoAvailability(key: string, value: 'ok' | 'missing') {
  if (!key) return;
  if (darkLogoAvailabilityCache.has(key)) {
    darkLogoAvailabilityCache.delete(key);
  }
  darkLogoAvailabilityCache.set(key, value);
  if (darkLogoAvailabilityCache.size <= DARK_LOGO_CACHE_MAX_ENTRIES) return;
  const oldestKey = darkLogoAvailabilityCache.keys().next().value as string | undefined;
  if (oldestKey) darkLogoAvailabilityCache.delete(oldestKey);
}

/** @internal visibleForTesting */
export function resetDarkLogoCache() {
  darkLogoAvailabilityCache.clear();
}

function isDarkModeEnabled(): boolean {
  if (typeof document === 'undefined') return false;
  const htmlTheme = document.documentElement.dataset.themeMode;
  if (htmlTheme === 'dark') return true;
  if (htmlTheme === 'light') return false;

  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function toDarkVariantSrc(src: string): string | null {
  try {
    const url = new URL(src, window.location.href);
    const lastSlash = url.pathname.lastIndexOf('/');
    const filename = url.pathname.substring(lastSlash + 1);
    if (!filename || filename.startsWith('darkmode-')) return null;
    url.pathname = url.pathname.substring(0, lastSlash + 1) + 'darkmode-' + filename;
    return url.toString();
  } catch {
    return null;
  }
}

export function toOriginalVariantSrc(src: string): string | null {
  try {
    const url = new URL(src, window.location.href);
    const lastSlash = url.pathname.lastIndexOf('/');
    const filename = url.pathname.substring(lastSlash + 1);
    if (!filename.toLowerCase().startsWith('darkmode-')) return null;
    url.pathname = url.pathname.substring(0, lastSlash + 1) + filename.substring('darkmode-'.length);
    return url.toString();
  } catch {
    return null;
  }
}

export function markDarkLogoMissing(darkSrc: string) {
  setDarkLogoAvailability(darkSrc, 'missing');
}

function bindFallbackHandlers(img: HTMLImageElement) {
  if (img.dataset.logoHandlersBound === 'true') return;

  img.addEventListener('error', () => {
    const original = img.dataset.logoOriginalSrc;
    const attemptedDark = img.dataset.logoDarkSrc;
    const current = getImgSrc(img);

    if (!original || !attemptedDark) return;
    if (current === original) return;

    img.dataset.logoDarkFailed = 'true';
    img.dataset.logoDarkFailedSrc = attemptedDark;
    setDarkLogoAvailability(attemptedDark, 'missing');
    img.src = original;
  });

  img.addEventListener('load', () => {
    const attemptedDark = img.dataset.logoDarkSrc;
    if (!attemptedDark) return;
    if (getImgSrc(img) !== attemptedDark) return;
    img.dataset.logoDarkFailed = 'false';
    img.dataset.logoDarkFailedSrc = '';
    setDarkLogoAvailability(attemptedDark, 'ok');
  });

  img.dataset.logoHandlersBound = 'true';
}

function syncOriginalSrc(img: HTMLImageElement): string {
  const current = getImgSrc(img);
  const previousOriginal = img.dataset.logoOriginalSrc;
  const currentDark = img.dataset.logoDarkSrc;
  const isCurrentDark = !!currentDark && current === currentDark;

  // If the image changed to a new non-dark source, treat it as a new base logo.
  if (!previousOriginal || (!isCurrentDark && current && current !== previousOriginal)) {
    img.dataset.logoOriginalSrc = current;
    img.dataset.logoDarkFailed = 'false';
    img.dataset.logoDarkFailedSrc = '';
  }

  return img.dataset.logoOriginalSrc || current;
}

function hasReadyImg(container: Element): boolean {
  return Array.from(container.querySelectorAll('img')).some((img) =>
    Boolean((img as HTMLImageElement).getAttribute('src')),
  );
}

function processNodeImages(node: Node) {
  if (!(node instanceof Element)) return;
  if (node instanceof HTMLImageElement) {
    processDarkLogoImage(node);
    return;
  }
  node.querySelectorAll('img').forEach((img) => processDarkLogoImage(img as HTMLImageElement));
}

/**
 * For one image:
 * - light mode: always use base file name
 * - dark mode: try "darkmode-*.<ext>" first, fallback to base on load error
 */
export function processDarkLogoImage(img: HTMLImageElement) {
  const current = getImgSrc(img);
  if (!current) return;

  bindFallbackHandlers(img);
  const original = syncOriginalSrc(img);
  if (!original) return;

  if (!isDarkModeEnabled()) {
    if (getImgSrc(img) !== original) img.src = original;
    return;
  }

  const darkSrc = toDarkVariantSrc(original);
  if (!darkSrc) return;

  // Don't keep retrying a dark logo we already know is missing.
  if (
    darkLogoAvailabilityCache.get(darkSrc) === 'missing' ||
    (img.dataset.logoDarkFailed === 'true' && img.dataset.logoDarkFailedSrc === darkSrc)
  ) {
    if (getImgSrc(img) !== original) img.src = original;
    return;
  }

  img.dataset.logoDarkSrc = darkSrc;
  if (getImgSrc(img) !== darkSrc) img.src = darkSrc;
}

/**
 * Process all images currently in a container.
 */
export function processDarkLogosInContainer(container: Element) {
  container.querySelectorAll('img').forEach((imgEl) => {
    processDarkLogoImage(imgEl as HTMLImageElement);
  });
}

export function observeDarkLogosInContainer(
  container: Element,
  { disconnectOnFirstImage = false }: { disconnectOnFirstImage?: boolean } = {},
): MutationObserver | null {
  if (typeof MutationObserver === 'undefined') return null;

  processDarkLogosInContainer(container);
  if (disconnectOnFirstImage && hasReadyImg(container)) return null;

  const logoObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(processNodeImages);
        return;
      }
      if (mutation.type === 'attributes' && mutation.target instanceof HTMLImageElement) {
        processDarkLogoImage(mutation.target);
      }
    });
    if (disconnectOnFirstImage && hasReadyImg(container)) logoObserver.disconnect();
  });

  logoObserver.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
  return logoObserver;
}
