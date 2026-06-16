import { config } from '../../../consts/config';
import { getUnifiedRouteMode, UnifiedRouteMode } from './routes';
import type { UnifiedToken } from './types';

export type UnifiedTokenRouteMode = UnifiedRouteMode | null;

export function getFeaturedTokenIndex(token: UnifiedToken): number {
  const tokenKey = `${token.chainName}-${token.symbol}`.toLowerCase();
  return config.featuredTokens.findIndex((featured) => featured.toLowerCase() === tokenKey);
}

export function getTokenRouteMode(
  token: UnifiedToken,
  counterpartToken: UnifiedToken | undefined,
  selectionMode: 'origin' | 'destination',
  collateralGroups: Parameters<typeof getUnifiedRouteMode>[0]['collateralGroups'],
  engineEnabled: boolean,
): UnifiedTokenRouteMode {
  if (!counterpartToken)
    return token.capabilities.bridge
      ? UnifiedRouteMode.Bridge
      : token.capabilities.swap
        ? UnifiedRouteMode.Swap
        : null;

  const originToken = selectionMode === 'origin' ? token : counterpartToken;
  const destinationToken = selectionMode === 'origin' ? counterpartToken : token;
  return getUnifiedRouteMode({ originToken, destinationToken, collateralGroups, engineEnabled });
}

export function getVisibleUnifiedTokens({
  allTokens,
  counterpartToken,
  selectionMode,
  collateralGroups,
  engineEnabled,
  hasFilter,
}: {
  allTokens: UnifiedToken[];
  counterpartToken: UnifiedToken | undefined;
  selectionMode: 'origin' | 'destination';
  collateralGroups: Parameters<typeof getUnifiedRouteMode>[0]['collateralGroups'];
  engineEnabled: boolean;
  hasFilter: boolean;
}): { tokens: UnifiedToken[]; isLimited: boolean } {
  const routeCounterpartToken = selectionMode === 'destination' ? counterpartToken : undefined;
  const routeModes = new Map<string, UnifiedTokenRouteMode>();
  const getRouteMode = (token: UnifiedToken) => {
    const cached = routeModes.get(token.key);
    if (routeModes.has(token.key)) return cached ?? null;
    const mode = getTokenRouteMode(
      token,
      routeCounterpartToken,
      selectionMode,
      collateralGroups,
      engineEnabled,
    );
    routeModes.set(token.key, mode);
    return mode;
  };

  const routableTokens = routeCounterpartToken
    ? allTokens.filter((token) => !!getRouteMode(token))
    : allTokens;

  const defaultTokens =
    !hasFilter && config.featuredTokens.length > 0
      ? routableTokens.filter((token) => getFeaturedTokenIndex(token) >= 0 || !!getRouteMode(token))
      : routableTokens;

  const sorted = [...defaultTokens].sort((a, b) => {
    const aFeatured = getFeaturedTokenIndex(a);
    const bFeatured = getFeaturedTokenIndex(b);
    if (aFeatured >= 0 || bFeatured >= 0) {
      if (aFeatured === -1) return 1;
      if (bFeatured === -1) return -1;
      if (aFeatured !== bFeatured) return aFeatured - bFeatured;
    }

    const aMode = getRouteMode(a);
    const bMode = getRouteMode(b);
    if (aMode && !bMode) return -1;
    if (!aMode && bMode) return 1;
    if (aMode === UnifiedRouteMode.Bridge && bMode === UnifiedRouteMode.Swap) return -1;
    if (aMode === UnifiedRouteMode.Swap && bMode === UnifiedRouteMode.Bridge) return 1;

    const symbolCompare = a.symbol.localeCompare(b.symbol);
    if (symbolCompare !== 0) return symbolCompare;
    return a.chainName.localeCompare(b.chainName);
  });

  const maxDisplay = 50;
  const shouldCap = !hasFilter && config.featuredTokens.length === 0;
  const isLimited = shouldCap && sorted.length > maxDisplay;
  return { tokens: isLimited ? sorted.slice(0, maxDisplay) : sorted, isLimited };
}
