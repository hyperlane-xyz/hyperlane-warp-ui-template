import type { ChainAddresses } from '@hyperlane-xyz/registry';

import type { ChainDiscovery } from '../api/types';
import type { RouteSecurityValidationFailure } from './types';
import { isUnsetAddress, sameTokenAddress } from './utils';

type TrustedUniversalRouterResult =
  | { valid: true; universalRouter: string }
  | RouteSecurityValidationFailure;

export function trustedUniversalRouterForChain({
  chain,
  chainAddresses,
  unavailableReason,
  mismatchReason,
  warpRouteId,
}: {
  chain: ChainDiscovery | undefined;
  chainAddresses: ChainAddresses | undefined;
  unavailableReason: string;
  mismatchReason: string;
  warpRouteId?: string;
}): TrustedUniversalRouterResult {
  const apiUniversalRouter = chain?.universalRouter;
  const registryUniversalRouter = chainAddresses?.universalRouter;

  if (
    !apiUniversalRouter ||
    !registryUniversalRouter ||
    isUnsetAddress(apiUniversalRouter) ||
    isUnsetAddress(registryUniversalRouter)
  ) {
    return { valid: false, reason: unavailableReason, warpRouteId };
  }

  if (!sameTokenAddress(apiUniversalRouter, registryUniversalRouter)) {
    return { valid: false, reason: mismatchReason, warpRouteId };
  }

  return { valid: true, universalRouter: registryUniversalRouter };
}
