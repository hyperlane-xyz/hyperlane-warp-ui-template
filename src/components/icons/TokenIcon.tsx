import { IToken } from '@hyperlane-xyz/sdk';
import { isHttpsUrl, isRelativeUrl } from '@hyperlane-xyz/utils';
import { Circle } from '@hyperlane-xyz/widgets';
import { useState } from 'react';
import { links } from '../../consts/links';

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
    <Circle size={size} bgColorSeed={bgColorSeed} title={title}>
      {imageSrc && !fallbackToText ? (
        <img
          src={imageSrc}
          width={size}
          height={size}
          className="p-0.5"
          onError={() => setFallbackToText(true)}
          loading="lazy"
        />
      ) : (
        <div className={`text-[${fontSize}px]`}>{character}</div>
      )}
    </Circle>
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
