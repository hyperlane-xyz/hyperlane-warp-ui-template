import Image from 'next/image';
import { ComponentProps, useMemo } from 'react';

import { ChainLogo as ChainLogoInner } from '@hyperlane-xyz/widgets';

import { parseCaip2Id } from '../../features/caip/chains';
import { getChainDisplayName } from '../../features/chains/utils';
import { getMultiProvider } from '../../features/multiProvider';
import { logger } from '../../utils/logger';
import { isNumeric } from '../../utils/string';

type Props = Omit<ComponentProps<typeof ChainLogoInner>, 'chainId' | 'chainName'> & {
  caip2Id?: Caip2Id;
};

export function ChainLogo(props: Props) {
  const { caip2Id, ...rest } = props;
  const { chainId, chainName, icon } = useMemo(() => {
    if (!caip2Id) return {};
    try {
      const { reference } = parseCaip2Id(caip2Id);
      const chainId = isNumeric(reference) ? parseInt(reference, 10) : undefined;
      const chainName = getChainDisplayName(caip2Id);
      const logoUri = getMultiProvider().tryGetChainMetadata(reference)?.logoURI;
      const icon = logoUri
        ? (props: { width: number; height: number; title?: string }) => (
            <Image src={logoUri} alt="" {...props} />
          )
        : undefined;
      return {
        chainId,
        chainName,
        icon,
      };
    } catch (error) {
      logger.error('Failed to parse caip2 id', error);
      return {};
    }
  }, [caip2Id]);

  return <ChainLogoInner {...rest} chainId={chainId} chainName={chainName} icon={icon} />;
}
