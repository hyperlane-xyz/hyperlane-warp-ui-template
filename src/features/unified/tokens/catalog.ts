import type { MultiProtocolProvider, Token } from '@hyperlane-xyz/sdk';
import type { ProtocolType } from '@hyperlane-xyz/utils';

import type { UiToken } from '../../swap/tokens/types';
import { getBridgeTokenIdentity, getSwapTokenIdentity, getUnifiedTokenKey } from './identity';
import type { UnifiedToken } from './types';

function fromBridgeToken(token: Token, multiProvider: MultiProtocolProvider): UnifiedToken {
  const chainId = multiProvider.tryGetChainMetadata(token.chainName)?.chainId as number | undefined;
  const identity = getBridgeTokenIdentity(token, multiProvider);

  return {
    key: getUnifiedTokenKey(identity),
    chainName: token.chainName,
    chainId,
    addressOrDenom: token.addressOrDenom,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    logoURI: token.logoURI,
    coinGeckoId: token.coinGeckoId,
    isNative: token.isNative() || token.isHypNative(),
    bridgeToken: token,
    bridgeRouteTokens: [token],
    capabilities: {
      bridge: true,
      swap: false,
    },
  };
}

function fromSwapToken(token: UiToken, protocol?: ProtocolType): UnifiedToken {
  const identity = getSwapTokenIdentity(token, protocol);

  return {
    key: getUnifiedTokenKey(identity),
    chainName: token.chainName,
    chainId: token.chainId,
    addressOrDenom: token.addressOrDenom,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    logoURI: token.logoURI,
    coinGeckoId: token.coinGeckoId,
    isNative: token.isNative,
    swapToken: token,
    capabilities: {
      bridge: false,
      swap: token.canSwap,
    },
  };
}

function mergeBridgeToken(existing: UnifiedToken, token: Token): UnifiedToken {
  const bridgeRouteTokens =
    existing.bridgeRouteTokens ?? (existing.bridgeToken ? [existing.bridgeToken] : []);
  return {
    ...existing,
    bridgeToken: existing.bridgeToken ?? token,
    bridgeRouteTokens: bridgeRouteTokens.includes(token)
      ? bridgeRouteTokens
      : [...bridgeRouteTokens, token],
    capabilities: {
      bridge: true,
      swap: existing.capabilities.swap,
    },
  };
}

function mergeToken(existing: UnifiedToken, token: UiToken): UnifiedToken {
  return {
    ...existing,
    chainId: existing.chainId ?? token.chainId,
    logoURI: existing.logoURI ?? token.logoURI,
    coinGeckoId: existing.coinGeckoId ?? token.coinGeckoId,
    swapToken: token,
    capabilities: {
      bridge: existing.capabilities.bridge,
      swap: token.canSwap,
    },
  };
}

export function buildUnifiedTokenCatalog({
  bridgeTokens,
  swapTokens,
  multiProvider,
}: {
  bridgeTokens: Token[];
  swapTokens: UiToken[];
  multiProvider: MultiProtocolProvider;
}): UnifiedToken[] {
  const byIdentity = new Map<string, UnifiedToken>();

  for (const token of bridgeTokens) {
    const identity = getBridgeTokenIdentity(token, multiProvider);
    const existing = byIdentity.get(identity);
    byIdentity.set(
      identity,
      existing ? mergeBridgeToken(existing, token) : fromBridgeToken(token, multiProvider),
    );
  }

  for (const token of swapTokens) {
    const protocol = multiProvider.tryGetChainMetadata(token.chainName)?.protocol;
    const identity = getSwapTokenIdentity(token, protocol);
    const existing = byIdentity.get(identity);
    byIdentity.set(
      identity,
      existing ? mergeToken(existing, token) : fromSwapToken(token, protocol),
    );
  }

  return Array.from(byIdentity.values());
}
