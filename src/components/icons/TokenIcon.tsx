import { IToken } from '@hyperlane-xyz/sdk';
import { isHttpsUrl, isRelativeUrl } from '@hyperlane-xyz/utils';
import { Circle } from '@hyperlane-xyz/widgets';
import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import { links } from '../../consts/links';
import {
  markDarkLogoMissing,
  processDarkLogoImage,
  toOriginalVariantSrc,
} from '../../utils/imageBrightness';

interface Props {
  token?: IToken | null;
  size?: number;
}

export function TokenIcon({ token, size = 32 }: Props) {
  const title = token?.symbol || '';
  const character = title ? title.charAt(0).toUpperCase() : '';
  const fontSize = Math.floor(size / 2);

  const [fallbackToText, setFallbackToText] = useState(false);
  const imageSrc = getImageSrc(token);
  const bgColorSeed =
    token && (!imageSrc || fallbackToText)
      ? (Buffer.from(token.addressOrDenom).at(0) || 0) % 5
      : undefined;

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    scheduleDarkLogoProcessing(event.currentTarget);
  }

  function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    const original = img.dataset.logoOriginalSrc;
    const attemptedDark = img.dataset.logoDarkSrc;
    const current = img.getAttribute('src') || img.src;
    const originalLoadFailed =
      !!original && current === original && img.complete && img.naturalWidth === 0;
    const darkFallbackAlreadyHandled =
      img.dataset.logoDarkFailed === 'true' &&
      !!original &&
      !!attemptedDark &&
      current === original;
    if (darkFallbackAlreadyHandled && !originalLoadFailed) return;

    const isDarkFallbackError = !!original && !!attemptedDark && current === attemptedDark;
    const fallbackSrc = toOriginalVariantSrc(current);
    const isDarkVariantSrc = fallbackSrc !== null;

    // Dark-variant misses should fall back to original logo, not text.
    if (isDarkFallbackError || isDarkVariantSrc) {
      markDarkLogoMissing(current);
      const nextSrc = fallbackSrc || original;
      if (nextSrc) {
        img.src = nextSrc;
        return;
      }
    }
    setFallbackToText(true);
  }

  return (
    <span className="inline-flex">
      <Circle size={size} bgColorSeed={bgColorSeed} title={title}>
        {imageSrc && !fallbackToText ? (
          <img
            src={imageSrc}
            className="h-full w-full p-0.5"
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className={`text-[${fontSize}px]`}>{character}</div>
        )}
      </Circle>
    </span>
  );
}

function getImageSrc(token?: IToken | null) {
  if (!token?.logoURI) return null;
  // If it's a valid, direct URL, return it
  if (isHttpsUrl(token.logoURI)) return token.logoURI;
  // Otherwise assume it's a relative URL to the registry base
  if (isRelativeUrl(token.logoURI)) return `${links.imgPath}${token.logoURI}`;
  return null;
}

function scheduleDarkLogoProcessing(img: HTMLImageElement) {
  if (typeof window === 'undefined') return;
  const win = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(() => processDarkLogoImage(img), { timeout: 200 });
    return;
  }
  window.setTimeout(() => processDarkLogoImage(img), 0);
}
