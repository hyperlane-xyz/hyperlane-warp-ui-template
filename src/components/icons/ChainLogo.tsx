import { ChainLogo as ChainLogoInner } from '@hyperlane-xyz/widgets';
import { useEffect, useRef } from 'react';
import { useChainMetadata } from '../../features/chains/hooks';
import { useStore } from '../../features/store';
import { processDarkLogoImage, processDarkLogosInContainer } from '../../utils/imageBrightness';

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
    processDarkLogosInContainer(el);

    const hasReadyImg = () =>
      Array.from(el.querySelectorAll('img')).some((img) => {
        const image = img as HTMLImageElement;
        return Boolean(image.getAttribute('src'));
      });

    if (hasReadyImg()) return;

    const processNodeImages = (node: Node) => {
      if (!(node instanceof Element)) return;
      if (node instanceof HTMLImageElement) {
        processDarkLogoImage(node);
        return;
      }
      node.querySelectorAll('img').forEach((img) => processDarkLogoImage(img as HTMLImageElement));
    };

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
      if (hasReadyImg()) logoObserver.disconnect();
    });

    logoObserver.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });

    return () => logoObserver.disconnect();
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
