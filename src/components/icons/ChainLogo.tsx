import { ComponentProps, useMemo } from 'react';

import { ChainLogo as ChainLogoInner } from '@hyperlane-xyz/widgets';

import { parseCaip2Id } from '../../features/chains/caip2';
import { getChainDisplayName } from '../../features/chains/utils';
import { logger } from '../../utils/logger';

type Props = Omit<ComponentProps<typeof ChainLogoInner>, 'chainId' | 'chainName'> & {
  caip2Id?: Caip2Id;
};

export function ChainLogo(props: Props) {
  const { caip2Id, ...rest } = props;
  // TODO update widget lib to support custom logos
  const { chainId, chainName } = useMemo(() => {
    if (!caip2Id) return {};
    try {
      const chainName = getChainDisplayName(caip2Id);
      const { reference } = parseCaip2Id(caip2Id);
      if (typeof reference === 'number') return { chainId: reference, chainName };
      else throw new Error('TODO support non-number reference');
    } catch (error) {
      logger.error('Failed to parse caip2 id', error);
      return { chainId: undefined, chainName: undefined };
    }
  }, [caip2Id]);
  return <ChainLogoInner {...rest} chainId={chainId} chainName={chainName} />;
}
