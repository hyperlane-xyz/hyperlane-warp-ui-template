import { useMemo } from 'react';

import { routerClient } from '../../api/RouterClient';
import type { TokensQuery } from '../../api/types';
import { useMultiProvider } from '../../chains/hooks';
import { useStore } from '../../store';
import { useTokens as useSwapTokens } from '../../swap/tokens/hooks';
import { useTokens as useBridgeTokens } from '../../tokens/hooks';
import { buildUnifiedTokenCatalog } from './catalog';
import type { UnifiedToken } from './types';

interface UseUnifiedTokensResult {
  data: UnifiedToken[];
  isLoading: boolean;
  engineEnabled: boolean;
}

export function useUnifiedTokens(query: TokensQuery = {}): UseUnifiedTokensResult {
  const multiProvider = useMultiProvider();
  const bridgeTokens = useBridgeTokens();
  const knownTokens = useStore((s) => s.knownTokens);
  const { data: swapTokens, isLoading: isSwapLoading } = useSwapTokens(
    routerClient.isConfigured ? query : {},
  );
  const allSwapTokens = useMemo(
    () => (routerClient.isConfigured ? [...knownTokens.values(), ...swapTokens] : []),
    [knownTokens, swapTokens],
  );

  const data = useMemo(
    () =>
      buildUnifiedTokenCatalog({
        bridgeTokens,
        swapTokens: allSwapTokens,
        multiProvider,
      }),
    [bridgeTokens, allSwapTokens, multiProvider],
  );

  return {
    data,
    isLoading: routerClient.isConfigured && isSwapLoading,
    engineEnabled: routerClient.isConfigured,
  };
}

export function useUnifiedTokenByKeyMap(tokens: UnifiedToken[]): Map<string, UnifiedToken> {
  return useMemo(() => {
    const map = new Map<string, UnifiedToken>();
    for (const token of tokens) map.set(token.key, token);
    return map;
  }, [tokens]);
}
