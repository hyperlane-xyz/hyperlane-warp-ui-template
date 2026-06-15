import type { Token } from '@hyperlane-xyz/sdk';

import { checkTokenHasRoute } from '../../tokens/utils';
import type { UnifiedToken } from './types';

export const UnifiedRouteMode = {
  Bridge: 'bridge',
  Swap: 'swap',
} as const;

export type UnifiedRouteMode = (typeof UnifiedRouteMode)[keyof typeof UnifiedRouteMode];

export function getUnifiedRouteMode({
  originToken,
  destinationToken,
  collateralGroups,
  engineEnabled,
}: {
  originToken: UnifiedToken | undefined;
  destinationToken: UnifiedToken | undefined;
  collateralGroups: Map<string, Token[]>;
  engineEnabled: boolean;
}): UnifiedRouteMode | null {
  if (!originToken || !destinationToken) return null;

  if (
    originToken.bridgeToken &&
    destinationToken.bridgeToken &&
    checkTokenHasRoute(originToken.bridgeToken, destinationToken.bridgeToken, collateralGroups)
  ) {
    return UnifiedRouteMode.Bridge;
  }

  if (engineEnabled && originToken.swapToken && destinationToken.swapToken) {
    return UnifiedRouteMode.Swap;
  }

  return null;
}
