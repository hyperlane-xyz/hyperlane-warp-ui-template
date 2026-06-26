import { fromWei } from '@hyperlane-xyz/utils';

import { config } from '../../../consts/config';
import { getTokenKey as getSwapTokenKey } from '../../swap/tokens/utils';
import { getTokenKey as getBridgeTokenKey } from '../../tokens/utils';
import { findUnifiedTokenByConfigRef } from './queryParams';
import { getUnifiedBridgeTokens, getUnifiedRouteMode, UnifiedRouteMode } from './routes';
import type { UnifiedToken } from './types';

export type UnifiedTokenRouteMode = UnifiedRouteMode | null;

export interface UnifiedTokenBalanceInfo {
  balance?: bigint | null;
  decimals?: number | null;
  usd?: number | null;
}

export function matchesUnifiedTokenSearch({
  token,
  query,
  chainDisplayName,
}: {
  token: UnifiedToken;
  query: string;
  chainDisplayName: string;
}): boolean {
  const normalizedQuery = query.toLowerCase();
  return (
    token.name.toLowerCase().includes(normalizedQuery) ||
    token.symbol.toLowerCase().includes(normalizedQuery) ||
    token.addressOrDenom.toLowerCase().includes(normalizedQuery) ||
    getUnifiedBridgeTokens(token).some(
      (bridgeToken) =>
        bridgeToken.addressOrDenom.toLowerCase().includes(normalizedQuery) ||
        bridgeToken.collateralAddressOrDenom?.toLowerCase().includes(normalizedQuery),
    ) ||
    !!token.swapToken?.address.toLowerCase().includes(normalizedQuery) ||
    !!token.swapToken?.addressOrDenom.toLowerCase().includes(normalizedQuery) ||
    token.chainName.toLowerCase().includes(normalizedQuery) ||
    chainDisplayName.toLowerCase().includes(normalizedQuery)
  );
}

export function getBalanceFetchLimit({
  tokenCount,
  requestedLimit,
  hasFilter,
  hasFeaturedTokens,
}: {
  tokenCount: number;
  requestedLimit: number;
  hasFilter: boolean;
  hasFeaturedTokens: boolean;
}): number {
  if (!hasFilter && hasFeaturedTokens) return tokenCount;
  return Math.min(requestedLimit, tokenCount);
}

export function getFeaturedTokenIndex(token: UnifiedToken): number {
  return config.featuredTokens.findIndex((featured) => {
    const parsed = parseFeaturedTokenRef(featured);
    return (
      !!parsed && findUnifiedTokenByConfigRef([token], parsed.chainName, parsed.tokenRef) === token
    );
  });
}

function parseFeaturedTokenRef(value: string): { chainName: string; tokenRef: string } | null {
  const separator = value.indexOf('-');
  if (separator <= 0) return null;
  return {
    chainName: value.slice(0, separator),
    tokenRef: value.slice(separator + 1),
  };
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
      ? routableTokens.filter((token) => getFeaturedTokenIndex(token) >= 0)
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

export function sortUnifiedTokensByBalance({
  tokens,
  balanceInfo,
  counterpartToken,
  selectionMode,
  collateralGroups,
  engineEnabled,
}: {
  tokens: UnifiedToken[];
  balanceInfo: Map<string, UnifiedTokenBalanceInfo>;
  counterpartToken: UnifiedToken | undefined;
  selectionMode: 'origin' | 'destination';
  collateralGroups: Parameters<typeof getUnifiedRouteMode>[0]['collateralGroups'];
  engineEnabled: boolean;
}): UnifiedToken[] {
  const originalIndex = new Map(tokens.map((token, index) => [token.key, index]));

  return [...tokens].sort((a, b) => {
    const aFeatured = getFeaturedTokenIndex(a) >= 0;
    const bFeatured = getFeaturedTokenIndex(b) >= 0;
    if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;

    const aRoute = getTokenRouteMode(
      a,
      counterpartToken,
      selectionMode,
      collateralGroups,
      engineEnabled,
    );
    const bRoute = getTokenRouteMode(
      b,
      counterpartToken,
      selectionMode,
      collateralGroups,
      engineEnabled,
    );
    const routeCompare = getRouteSortRank(aRoute) - getRouteSortRank(bRoute);
    if (routeCompare !== 0) return routeCompare;

    const aInfo = balanceInfo.get(a.key);
    const bInfo = balanceInfo.get(b.key);
    const aUsd = aInfo?.usd ?? 0;
    const bUsd = bInfo?.usd ?? 0;
    if (aUsd > 0 || bUsd > 0) {
      if (aUsd !== bUsd) return bUsd - aUsd;
    }

    const aBalance = aInfo?.balance ?? 0n;
    const bBalance = bInfo?.balance ?? 0n;
    if (aBalance > 0n || bBalance > 0n) {
      const balanceCompare = compareDecimalBalances(
        aBalance,
        aInfo?.decimals,
        bBalance,
        bInfo?.decimals,
      );
      if (balanceCompare !== 0) return balanceCompare;
    }

    return (originalIndex.get(a.key) ?? 0) - (originalIndex.get(b.key) ?? 0);
  });
}

function compareDecimalBalances(
  aBalance: bigint,
  aDecimals: number | null | undefined,
  bBalance: bigint,
  bDecimals: number | null | undefined,
): number {
  const aScale = 10n ** BigInt(Math.max(bDecimals ?? 0, 0));
  const bScale = 10n ** BigInt(Math.max(aDecimals ?? 0, 0));
  const aNormalized = aBalance * aScale;
  const bNormalized = bBalance * bScale;
  if (aNormalized > bNormalized) return -1;
  if (aNormalized < bNormalized) return 1;
  return 0;
}

function getRouteSortRank(mode: UnifiedTokenRouteMode): number {
  if (mode === UnifiedRouteMode.Bridge) return 0;
  if (mode === UnifiedRouteMode.Swap) return 1;
  return 2;
}

export function buildUnifiedTokenBalanceInfo({
  tokens,
  bridgeBalances,
  swapBalances,
  prices,
}: {
  tokens: UnifiedToken[];
  bridgeBalances: Record<string, bigint>;
  swapBalances: Record<string, bigint>;
  prices: Record<string, number>;
}): Map<string, UnifiedTokenBalanceInfo> {
  const result = new Map<string, UnifiedTokenBalanceInfo>();

  for (const token of tokens) {
    const candidates = [
      ...getUnifiedBridgeTokens(token).map((bridgeToken) => ({
        balance: bridgeBalances[getBridgeTokenKey(bridgeToken)],
        decimals: bridgeToken.decimals,
        coinGeckoId: bridgeToken.coinGeckoId,
      })),
      ...(token.swapToken
        ? [
            {
              balance: swapBalances[getSwapTokenKey(token.swapToken)],
              decimals: token.swapToken.decimals,
              coinGeckoId: token.swapToken.coinGeckoId,
            },
          ]
        : []),
    ];

    const selected =
      candidates.find((candidate) => candidate.balance != null && candidate.balance > 0n) ??
      candidates.find((candidate) => candidate.balance != null);
    if (!selected || selected.balance == null) continue;

    const price = selected.coinGeckoId ? prices[selected.coinGeckoId] : undefined;
    const usd =
      price != null
        ? parseFloat(fromWei(selected.balance.toString(), selected.decimals)) * price
        : null;
    result.set(token.key, {
      balance: selected.balance,
      decimals: selected.decimals,
      usd,
    });
  }

  return result;
}
