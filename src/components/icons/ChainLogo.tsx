import { ChainLogo as ChainLogoInner } from '@hyperlane-xyz/widgets';
import { useEffect, useRef } from 'react';
import { useChainMetadata } from '../../features/chains/hooks';
import { useStore } from '../../features/store';
import { observeDarkLogosInContainer } from '../../utils/imageBrightness';

export function ChainLogo({
  chainName,
  background,
  size,
}: {
  chainName?: string;
  background?: boolean;
  size?: number;
}) {
  const registry = useStore((s) => s.registry);
  const chainMetadata = useChainMetadata(chainName);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const name = chainMetadata?.name || '';
  const logoUri = chainMetadata?.logoURI;

  // Process immediately; keep a short-lived observer until the logo image first appears.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const logoObserver = observeDarkLogosInContainer(el, { disconnectOnFirstImage: true });
    return () => logoObserver?.disconnect();
  }, [chainName, logoUri]);

  return (
    <span ref={wrapperRef} className="inline-flex">
      <ChainLogoInner
        chainName={name}
        logoUri={logoUri}
        registry={registry}
        size={size}
        background={background}
      />
    </span>
  );
}
