import { useMemo } from 'react';

import { ProtocolType } from '@hyperlane-xyz/utils';

import type { ChainInfo } from '../chains/hooks';
import { useMultiProvider } from '../chains/hooks';
import { useSwapChainInfos } from '../swap/chains/hooks';
import { useTokenByKeyMap as useEngineTokenByKeyMap } from '../swap/tokens/hooks';
import { getTokenKey as getEngineTokenKey } from '../swap/tokens/utils';
import { useTokens as useWarpTokens, useWarpCoreTokens } from '../tokens/hooks';
import { isHypNativeStandard, warpTokenToCombined } from './warpUtils';
import type { CombinedToken } from './types';

// Merge a WarpCore CombinedToken into an existing engine-based map, deduplicating
// native tokens by (chainId, isNative) when addresses differ (HypNative vs 0x000...).
// Mutates `map` in place and returns whether the token was matched/enriched.
function mergeIntoMap(map: Map<string, CombinedToken>, t: CombinedToken): boolean {
  const key = getEngineTokenKey(t);
  if (map.has(key)) {
    const existing = map.get(key)!;
    // Prefer warpCoreKey from a token whose symbol matches the engine entry's symbol.
    // Multiple WarpCore tokens can share the same collateral address (e.g. USDC and
    // USDCSTAGE). Without this, whichever is processed last wins and the bridge badge
    // / fee estimation could silently use the staging variant.
    const shouldUpdateKey = !existing.warpCoreKey || t.symbol === existing.symbol;
    map.set(key, { ...existing, warpCoreKey: shouldUpdateKey ? t.warpCoreKey : existing.warpCoreKey, canBridge: true });
    return true;
  }
  // Secondary dedup for HypNative tokens: engine uses a different address (e.g. 0x000...)
  // than the WarpCore router contract. Match by (chainId, isNative=true) instead.
  if (t.isNative) {
    for (const [k, existing] of map) {
      if (existing.chainId === t.chainId && existing.isNative) {
        map.set(k, { ...existing, warpCoreKey: t.warpCoreKey, canBridge: true });
        return true;
      }
    }
  }
  return false;
}

// Returns a combined token map (engine-style keys "chainId-address" → CombinedToken)
// that merges engine tokens with WarpCore tokens.
// Engine tokens are enriched with warpCoreKey where a WarpCore token exists at the
// same address (or same chain for native tokens). WarpCore-only tokens are appended.
export function useCombinedTokenMap(): Map<string, CombinedToken> {
  const engineTokenMap = useEngineTokenByKeyMap();
  const allWarpCombined = useAllWarpCombinedTokens();

  return useMemo(() => {
    const map = new Map<string, CombinedToken>();

    // Seed with engine tokens.
    for (const [key, token] of engineTokenMap) {
      map.set(key, { ...token });
    }

    // Merge WarpCore tokens: enrich existing engine entries or append WarpCore-only ones.
    for (const t of allWarpCombined) {
      const matched = mergeIntoMap(map, t);
      if (!matched) {
        map.set(getEngineTokenKey(t), t);
      }
    }

    return map;
  }, [engineTokenMap, allWarpCombined]);
}

// Returns a store-level token lookup backed by the combined map.
export function getCombinedTokenByKey(
  map: Map<string, CombinedToken>,
  key: string | undefined,
): CombinedToken | undefined {
  if (!key) return undefined;
  return map.get(key);
}

// Returns all WarpCore tokens as CombinedToken for the origin picker.
// These are the deduplicated origin tokens from WarpCore (bridge-capable, includes non-EVM).
export function useAllWarpCombinedTokens(): CombinedToken[] {
  const multiProvider = useMultiProvider();
  const warpTokens = useWarpTokens();

  return useMemo(() => {
    return warpTokens
      .map((t) => warpTokenToCombined(t, multiProvider))
      .filter((t): t is CombinedToken => t !== null);
  }, [warpTokens, multiProvider]);
}

// Returns WarpCore destination tokens reachable from the given origin (by engine coords).
// These are the direct bridge destinations that should appear in the destination picker
// even when the engine doesn't list them.
// srcWarpCoreKey: prefer using this for WarpCore origin lookup (reliable for HypNative
// tokens whose addressOrDenom is the router contract, not the canonical native address).
export function useWarpDestinations(
  srcChainId: number | null,
  srcAddress: string,
  srcIsNative?: boolean,
): CombinedToken[] {
  const multiProvider = useMultiProvider();
  // Use raw (non-deduplicated) WarpCore tokens so we find every route instance for the
  // source token. dedupeTokensByCollateral in store.tokens keeps only one Arbitrum USDC
  // token, but different route instances have different connection sets. Unioning across
  // all instances exposes destinations like Base USDC that only appear in some routes.
  const rawTokens = useWarpCoreTokens();

  return useMemo(() => {
    if (!srcChainId || !srcAddress) return [];

    const srcChainName = multiProvider.tryGetChainName(srcChainId) ?? '';
    const normalizedSrc = srcAddress.toLowerCase();

    const originTokens = rawTokens.filter((t) => {
      if (t.chainName !== srcChainName) return false;
      // Native tokens: the engine stores address as 0x000...0000 but WarpCore HypNative
      // tokens store the router contract. Match by HypNative standard instead of address.
      if (srcIsNative) return isHypNativeStandard(t.standard);
      return (
        t.addressOrDenom.toLowerCase() === normalizedSrc ||
        t.collateralAddressOrDenom?.toLowerCase() === normalizedSrc
      );
    });

    if (!originTokens.length) return [];

    const seen = new Set<string>();
    const results: CombinedToken[] = [];
    for (const origin of originTokens) {
      for (const conn of origin.getConnections()) {
        const combined = warpTokenToCombined(conn.token as any, multiProvider);
        if (!combined) continue;
        const key = getEngineTokenKey(combined);
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(combined);
      }
    }
    return results;
  }, [srcChainId, srcAddress, rawTokens, multiProvider]);
}

// Returns a merged chain list for the token picker's chain filter panel.
// Combines engine chains (from /v1/chains) with WarpCore-only chains (Solana, Radix, Aleo,
// Cosmos) that the engine doesn't know about.
export function useMergedChainInfos(): ChainInfo[] {
  const engineChains = useSwapChainInfos();
  const allWarpTokens = useAllWarpCombinedTokens();
  const multiProvider = useMultiProvider();

  return useMemo(() => {
    const merged = new Map<string, ChainInfo>();
    for (const c of engineChains) {
      merged.set(c.name, c);
    }

    // Append WarpCore-only chains not covered by the engine.
    for (const t of allWarpTokens) {
      if (merged.has(t.chainName)) continue;
      const meta = multiProvider.tryGetChainMetadata(t.chainName);
      if (!meta) continue;
      merged.set(t.chainName, {
        name: t.chainName,
        displayName: meta.displayName || t.chainName,
        chainId: meta.chainId ?? (meta as any).domainId,
        protocol: (meta.protocol ?? ProtocolType.Ethereum) as ProtocolType,
        isTestnet: !!meta.isTestnet,
        disabled: false,
      });
    }

    return Array.from(merged.values());
  }, [engineChains, allWarpTokens, multiProvider]);
}
