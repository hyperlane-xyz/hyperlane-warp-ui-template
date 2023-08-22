import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { logger } from '../../../utils/logger';
import { getChainIdFromToken } from '../../caip/tokens';
import { getTokens, parseTokens } from '../metadata';
import { TokenMetadataWithHypTokens } from '../types';

import { computeTokenRoutes, fetchRemoteHypTokens } from './fetch';
import { RoutesMap } from './types';

export function useTokenRoutes() {
  const {
    isLoading,
    data: tokenRoutes,
    error,
  } = useQuery(
    ['token-routes'],
    async () => {
      logger.info('Searching for token routes');
      const parsedTokens = await parseTokens();
      const tokens: TokenMetadataWithHypTokens[] = [];
      for (const token of parsedTokens) {
        // Consider parallelizing here but concerned about RPC rate limits
        const tokenWithHypTokens = await fetchRemoteHypTokens(token, parsedTokens);
        tokens.push(tokenWithHypTokens);
      }
      return computeTokenRoutes(tokens);
    },
    { retry: false },
  );

  return { isLoading, error, tokenRoutes };
}

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
