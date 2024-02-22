import Image from 'next/image';
import { ComponentProps, useMemo } from 'react';

import { ChainLogo as ChainLogoInner } from '@hyperlane-xyz/widgets';

import { getChainDisplayName, tryGetChainMetadata } from '../../features/chains/utils';

export function ChainLogo(props: ComponentProps<typeof ChainLogoInner>) {
  const { chainName, ...rest } = props;
  const { chainId, chainDisplayName, icon } = useMemo(() => {
    if (!chainName) return {};
    const chainDisplayName = getChainDisplayName(chainName);
    const chainMetadata = tryGetChainMetadata(chainName);
    const chainId = chainMetadata?.chainId;
    const logoUri = chainMetadata?.logoURI;
    const icon = logoUri
      ? (props: { width: number; height: number; title?: string }) => (
          <Image src={logoUri} alt="" {...props} />
        )
      : undefined;
    return {
      chainId,
      chainDisplayName,
      icon,
    };
  }, [chainName]);

  return <ChainLogoInner {...rest} chainId={chainId} chainName={chainDisplayName} icon={icon} />;
}
