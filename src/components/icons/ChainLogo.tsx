import { ChainLogo as ChainLogoInner } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useMemo } from 'react';
import { getRegistry } from '../../context/context';
import { tryGetChainMetadata } from '../../features/chains/utils';

export function ChainLogo({
  chainName,
  background,
  size,
}: {
  chainName?: string;
  background?: boolean;
  size?: number;
}) {
  const registry = getRegistry();
  const { name, Icon } = useMemo(() => {
    if (!chainName) return { name: '' };
    const chainMetadata = tryGetChainMetadata(chainName);
    const name = chainMetadata?.name || '';
    const logoUri = chainMetadata?.logoURI;
    const Icon = logoUri
      ? (props: { width: number; height: number; title?: string }) => (
          <Image src={logoUri} alt="" {...props} />
        )
      : undefined;
    return {
      name,
      Icon,
    };
  }, [chainName]);

  return (
    <ChainLogoInner
      chainName={name}
      registry={registry}
      size={size}
      background={background}
      Icon={Icon}
    />
  );
}
