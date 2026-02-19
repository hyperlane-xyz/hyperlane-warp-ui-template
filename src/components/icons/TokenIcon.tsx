import { IToken } from '@hyperlane-xyz/sdk';
import { isHttpsUrl, isRelativeUrl } from '@hyperlane-xyz/utils';
import { Circle } from '@hyperlane-xyz/widgets';
import { useState } from 'react';
import { links } from '../../consts/links';
import { markDarkLogoMissing, processDarkLogoImage } from '../../utils/imageBrightness';

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

  return (
    <span className="inline-flex">
      <Circle size={size} bgColorSeed={bgColorSeed} title={title}>
        {imageSrc && !fallbackToText ? (
          <img
            src={imageSrc}
            className="h-full w-full p-0.5"
            onLoad={(event) => scheduleDarkLogoProcessing(event.currentTarget)}
            onError={(event) => {
              const img = event.currentTarget;
              const current = img.getAttribute('src') || img.src;
              const original = img.dataset.logoOriginalSrc;
              const attemptedDark = img.dataset.logoDarkSrc;
              const isDarkFallbackError =
                !!original && !!attemptedDark && current === attemptedDark;
              const fallbackSrc = current.replace(
                /(^|\/)darkmode-([^/]+)\.([a-z0-9]+)(?=([?#].*)?$)/i,
                '$1$2.$3',
              );
              const isDarkVariantSrc = fallbackSrc !== current;

              // Dark-variant misses should fall back to original logo, not text.
              if (isDarkFallbackError || isDarkVariantSrc) {
                markDarkLogoMissing(current);
                if (isDarkVariantSrc) {
                  img.src = fallbackSrc;
                }
                return;
              }
              setFallbackToText(true);
            }}
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
