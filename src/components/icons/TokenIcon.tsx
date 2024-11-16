import { IRegistry } from '@hyperlane-xyz/registry';
import { IToken } from '@hyperlane-xyz/sdk';
import { Circle } from '@hyperlane-xyz/widgets';
import { useStore } from '../../features/store';
import { isValidHttpsUrl, isValidRelativeUrl } from '../../utils/url';
import { ErrorBoundary } from '../errors/ErrorBoundary';

interface Props {
  token?: IToken | null;
  size?: number;
}

export function TokenIcon({ token, size = 32 }: Props) {
  const title = token?.symbol || '';
  const character = title ? title.charAt(0).toUpperCase() : '';
  const fontSize = Math.floor(size / 2);

  const registry = useStore((s) => s.registry);
  const imageSrc = getImageSrc(registry, token);
  const bgColorSeed =
    token && !imageSrc ? (Buffer.from(token.addressOrDenom).at(0) || 0) % 5 : undefined;

  return (
    <Circle size={size} bgColorSeed={bgColorSeed} title={title}>
      {imageSrc ? (
        <ErrorBoundary hideError={true}>
          <img src={imageSrc} width={size} height={size} className="p-0.5" />
        </ErrorBoundary>
      ) : (
        <div className={`text-[${fontSize}px]`}>{character}</div>
      )}
    </Circle>
  );
}

function getImageSrc(registry: IRegistry, token?: IToken | null) {
  if (!token?.logoURI) return null;
  // If it's a valid, direct URL, return it
  if (isValidHttpsUrl(token.logoURI)) return token.logoURI;
  // Otherwise assume it's a relative URL to the registry base
  if (isValidRelativeUrl(token.logoURI)) return registry.getUri(token.logoURI);
  return null;
}
