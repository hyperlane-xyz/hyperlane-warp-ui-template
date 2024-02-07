import { useMemo } from 'react';

import { getChainIdFromToken } from '../caip/tokens';
import { getTokens } from '../tokens/metadata';

import { RoutesMap } from './types';

export function useRouteChains(tokenRoutes: RoutesMap): ChainCaip2Id[] {
  return useMemo(() => {
    const allCaip2Ids = Object.keys(tokenRoutes) as ChainCaip2Id[];
    const collateralCaip2Ids = getTokens().map((t) => getChainIdFromToken(t.tokenCaip19Id));
    return allCaip2Ids.sort((c1, c2) => {
      // Surface collateral chains first
      if (collateralCaip2Ids.includes(c1) && !collateralCaip2Ids.includes(c2)) return -1;
      else if (!collateralCaip2Ids.includes(c1) && collateralCaip2Ids.includes(c2)) return 1;
      else return c1 > c2 ? 1 : -1;
    });
  }, [tokenRoutes]);
}
