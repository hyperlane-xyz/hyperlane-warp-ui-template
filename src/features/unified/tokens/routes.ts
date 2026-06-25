import type { Token } from '@hyperlane-xyz/sdk';

import { findConnectedDestinationToken, getCollateralKey, getTokenKey } from '../../tokens/utils';
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

  if (findUnifiedBridgeRoutePair(originToken, destinationToken, collateralGroups)) {
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

export function findUnifiedBridgeRoutePair(
  originToken: UnifiedToken | undefined,
  destinationToken: UnifiedToken | undefined,
  collateralGroups: Map<string, Token[]>,
): { originToken: Token; destinationToken: Token } | undefined {
  const originBridgeTokens = getUnifiedBridgeTokens(originToken);
  const destinationBridgeTokens = getUnifiedBridgeTokens(destinationToken);

  const originCandidates = new Map<string, Token>();
  for (const origin of originBridgeTokens) {
    originCandidates.set(getTokenKey(origin), origin);
    for (const groupToken of collateralGroups.get(getCollateralKey(origin)) ?? []) {
      originCandidates.set(getTokenKey(groupToken), groupToken);
    }
  }

  for (const origin of originCandidates.values()) {
    for (const destination of destinationBridgeTokens) {
      const connectedDestination = findConnectedDestinationToken(origin, destination);
      if (connectedDestination)
        return { originToken: origin, destinationToken: connectedDestination };
    }
  }
  return undefined;
}
