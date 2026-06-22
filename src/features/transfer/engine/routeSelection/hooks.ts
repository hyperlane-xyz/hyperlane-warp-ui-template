import { useMemo } from 'react';

import type { QuoteStep } from '../../../api/types';
import { useTokens } from '../../../tokens/hooks';

// Triggers useTokens for every chain that appears in a route's steps so route
// intermediate tokens are loaded into knownTokens. Hooks must be called
// unconditionally, so we support up to 4 unique chains — more than enough for
// any realistic route.
export function useRouteChainTokens(steps: QuoteStep[]) {
  const chainIds = useMemo(() => {
    const seen = new Set<number>();
    for (const s of steps) {
      seen.add(s.chain);
      if (s.type === 'bridge') seen.add(s.destChain);
    }
    return [...seen];
  }, [steps]);

  useTokens(chainIds[0] != null ? { chain: chainIds[0] } : {});
  useTokens(chainIds[1] != null ? { chain: chainIds[1] } : {});
  useTokens(chainIds[2] != null ? { chain: chainIds[2] } : {});
  useTokens(chainIds[3] != null ? { chain: chainIds[3] } : {});
}
