import type { Token } from '@hyperlane-xyz/sdk';

import { checkTokenHasRoute } from '../../tokens/utils';
import type { UnifiedToken } from './types';

export const UnifiedRouteMode = {
  Bridge: 'bridge',
  Swap: 'swap',
} as const;

export type UnifiedRouteMode = (typeof UnifiedRouteMode)[keyof typeof UnifiedRouteMode];

export function getUnifiedBridgeTokens(token: UnifiedToken | undefined): Token[] {
  if (!token) return [];
  return token.bridgeRouteTokens ?? (token.bridgeToken ? [token.bridgeToken] : []);
}

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

  const originBridgeTokens = getUnifiedBridgeTokens(originToken);
  const destinationBridgeTokens = getUnifiedBridgeTokens(destinationToken);
  if (
    originBridgeTokens.some((origin) =>
      destinationBridgeTokens.some((destination) =>
        checkTokenHasRoute(origin, destination, collateralGroups),
      ),
    )
  ) {
    return UnifiedRouteMode.Bridge;
  }

  if (
    engineEnabled &&
    originToken.capabilities.swap &&
    destinationToken.capabilities.swap &&
    originToken.swapToken &&
    destinationToken.swapToken
  ) {
    return UnifiedRouteMode.Swap;
  }

  return null;
}
